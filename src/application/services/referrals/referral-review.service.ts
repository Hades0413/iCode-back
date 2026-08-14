import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { extname } from 'node:path';
import { Repository } from 'typeorm';
import { ReferralReview } from '../../../domain/entities/referrals/referral-review.entity';
import { TransitionSummary } from '../../../domain/entities/clinical/transition-summary.entity';
import { User } from '../../../domain/entities/user.entity';
import { ReferralReviewStatus } from '../../../domain/enums/referral-review-status.enum';
import { ClinicalSummaryStatus } from '../../../domain/enums/clinical-summary-status.enum';
import { PatientTransitionService } from '../transition/patient-transition.service';
import { ReferralReviewStorageService } from './referral-review-storage.service';
import { ReviewReferralRejectionDto } from '../../dto/referrals/review-referral-rejection.dto';
import { ReviewReferralObservationDto } from '../../dto/referrals/review-referral-observation.dto';
import {
  ReferralReviewResponseDto,
  ReferralReviewResultDto,
} from '../../dto/referrals/referral-review-response.dto';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(['.pdf']);

/**
 * Lo que dijo el destino (posta/hospital) sobre la historia clínica de
 * transferencia ya firmada: aceptó, rechazó, u observó (con un PDF de
 * vuelta explicando qué falta). Solo tiene sentido una vez que
 * "TransitionSummary" está APPROVED — depende de TransitionModule
 * (findDetail), nunca al revés.
 */
@Injectable()
export class ReferralReviewService {
  constructor(
    @InjectRepository(ReferralReview)
    private readonly reviewRepository: Repository<ReferralReview>,
    @InjectRepository(TransitionSummary)
    private readonly summaryRepository: Repository<TransitionSummary>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly patientTransitionService: PatientTransitionService,
    private readonly storageService: ReferralReviewStorageService,
  ) {}

  async findByPatient(patientId: number): Promise<ReferralReviewResponseDto> {
    const review = await this.getOrFail(patientId);
    const name = await this.resolveName(review.reviewedById);
    return this.toResponseDto(review, name);
  }

  async accept(
    patientId: number,
    currentUserId: number,
  ): Promise<ReferralReviewResultDto> {
    await this.assertSummaryApproved(patientId);
    return this.save(
      patientId,
      { status: ReferralReviewStatus.ACCEPTED, notes: null },
      currentUserId,
    );
  }

  async reject(
    patientId: number,
    dto: ReviewReferralRejectionDto,
    currentUserId: number,
  ): Promise<ReferralReviewResultDto> {
    await this.assertSummaryApproved(patientId);
    return this.save(
      patientId,
      { status: ReferralReviewStatus.REJECTED, notes: dto.notes },
      currentUserId,
    );
  }

  async observe(
    patientId: number,
    dto: ReviewReferralObservationDto,
    file: Express.Multer.File,
    currentUserId: number,
  ): Promise<ReferralReviewResultDto> {
    this.assertValidFile(file);
    await this.assertSummaryApproved(patientId);
    const storagePath = await this.storageService.save(
      patientId,
      file.originalname,
      file.buffer,
    );
    return this.save(
      patientId,
      {
        status: ReferralReviewStatus.OBSERVED,
        notes: dto.notes ?? null,
        fileName: file.originalname,
        fileSize: file.size,
        storagePath,
      },
      currentUserId,
    );
  }

  resolveDocumentPath(review: ReferralReview): string {
    if (!review.storagePath) {
      throw new NotFoundException('Esta revisión no tiene un PDF adjunto');
    }
    return this.storageService.resolveAbsolutePath(review.storagePath);
  }

  async getOrFail(patientId: number): Promise<ReferralReview> {
    const review = await this.reviewRepository.findOne({
      where: { patientId },
    });
    if (!review) {
      throw new NotFoundException(
        'Todavía no se registró una respuesta del destino para este paciente',
      );
    }
    return review;
  }

  private async assertSummaryApproved(patientId: number): Promise<void> {
    const summary = await this.summaryRepository.findOne({
      where: { patientId },
    });
    if (!summary || summary.status !== ClinicalSummaryStatus.APPROVED) {
      throw new ConflictException(
        'Todavía no se puede revisar: la historia clínica de transferencia no está firmada',
      );
    }
  }

  private assertValidFile(file: Express.Multer.File): void {
    if (!file) {
      throw new BadRequestException('Falta el PDF con lo observado');
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException('El archivo supera los 10 MB permitidos');
    }
    if (!ALLOWED_EXTENSIONS.has(extname(file.originalname).toLowerCase())) {
      throw new BadRequestException('Solo se acepta un archivo .pdf');
    }
  }

  private async save(
    patientId: number,
    fields: {
      status: ReferralReviewStatus;
      notes: string | null;
      fileName?: string;
      fileSize?: number;
      storagePath?: string;
    },
    currentUserId: number,
  ): Promise<ReferralReviewResultDto> {
    const now = new Date();
    let review = await this.reviewRepository.findOne({ where: { patientId } });
    if (review) {
      review.status = fields.status;
      review.notes = fields.notes;
      review.fileName = fields.fileName ?? null;
      review.fileSize = fields.fileSize ?? null;
      review.storagePath = fields.storagePath ?? null;
      review.reviewedById = currentUserId;
      review.reviewedAt = now;
      review.updatedAt = now;
      review.updatedById = currentUserId;
    } else {
      review = this.reviewRepository.create({
        patientId,
        status: fields.status,
        notes: fields.notes,
        fileName: fields.fileName ?? null,
        fileSize: fields.fileSize ?? null,
        storagePath: fields.storagePath ?? null,
        reviewedById: currentUserId,
        reviewedAt: now,
        createdAt: now,
        createdById: currentUserId,
      });
    }
    const saved = await this.reviewRepository.save(review);
    const [patient, name] = await Promise.all([
      this.patientTransitionService.findDetail(patientId),
      this.resolveName(currentUserId),
    ]);
    return { patient, referralReview: this.toResponseDto(saved, name) };
  }

  private async resolveName(userId: number): Promise<string> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    return user ? `${user.firstName} ${user.lastName}`.trim() : '';
  }

  private toResponseDto(
    review: ReferralReview,
    reviewedBy: string,
  ): ReferralReviewResponseDto {
    return {
      patientId: String(review.patientId),
      status: review.status,
      notes: review.notes,
      fileName: review.fileName,
      fileSize: review.fileSize,
      reviewedBy,
      reviewedAt: review.reviewedAt.toISOString(),
    };
  }
}
