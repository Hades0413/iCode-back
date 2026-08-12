import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CounterReferral } from '../../../domain/entities/referrals/counter-referral.entity';
import { User } from '../../../domain/entities/user.entity';
import { CounterReferralStatus } from '../../../domain/enums/counter-referral-status.enum';
import { PatientTransitionService } from '../transition/patient-transition.service';
import { CounterReferralStorageService } from './counter-referral-storage.service';
import { UploadCounterReferralDto } from '../../dto/referrals/upload-counter-referral.dto';
import {
  CounterReferralResponseDto,
  CounterReferralResultDto,
} from '../../dto/referrals/counter-referral-response.dto';
import { PatientTransitionResponseDto } from '../../dto/transition/patient-transition-response.dto';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = ['.pdf', '.doc', '.docx'];

/**
 * La carta de contrarreferencia — depende de TransitionModule
 * (getRuleContext/setCounterReferralStatus/findPostTransition), nunca al
 * revés. La regla dura: nunca puede salir antes del cumpleaños. Ver
 * PUENTE18_FRONTEND_INTEGRATION.md, sección 5.
 */
@Injectable()
export class CounterReferralService {
  constructor(
    @InjectRepository(CounterReferral)
    private readonly counterReferralRepository: Repository<CounterReferral>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly patientTransitionService: PatientTransitionService,
    private readonly storageService: CounterReferralStorageService,
  ) {}

  async findByPatient(patientId: number): Promise<CounterReferralResponseDto> {
    const counterReferral = await this.getOrFail(patientId);
    const nameById = await this.resolveNames(
      counterReferral.sentById !== null
        ? [counterReferral.uploadedById, counterReferral.sentById]
        : [counterReferral.uploadedById],
    );
    return this.toResponseDto(counterReferral, nameById);
  }

  /** GET /referrals/counter-queue — una tarjeta por cada paciente que ya cumplió 18. */
  async findCounterQueue(): Promise<
    Array<{
      patient: PatientTransitionResponseDto;
      counterReferral: CounterReferralResponseDto | null;
    }>
  > {
    const patients = await this.patientTransitionService.findPostTransition();
    if (patients.length === 0) {
      return [];
    }
    const counterReferrals = await this.counterReferralRepository.find({
      where: { patientId: In(patients.map((p) => p.patientId)) },
    });
    const nameById = await this.resolveNames(
      counterReferrals.flatMap((c) =>
        c.sentById !== null ? [c.uploadedById, c.sentById] : [c.uploadedById],
      ),
    );
    return patients.map((patient) => {
      const cr = counterReferrals.find(
        (c) => c.patientId === patient.patientId,
      );
      return {
        patient,
        counterReferral: cr ? this.toResponseDto(cr, nameById) : null,
      };
    });
  }

  async upload(
    patientId: number,
    dto: UploadCounterReferralDto,
    file: { originalname: string; size: number; buffer: Buffer },
    currentUserId: number,
  ): Promise<CounterReferralResultDto> {
    if (!file) {
      throw new BadRequestException('Falta el archivo de la carta');
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException('El archivo supera los 10 MB permitidos');
    }
    const extension = this.extensionOf(file.originalname);
    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      throw new BadRequestException(
        'Solo se aceptan archivos .pdf, .doc o .docx',
      );
    }

    const context =
      await this.patientTransitionService.getRuleContext(patientId);
    if (!context.isAdult) {
      throw new ConflictException(
        'La carta no puede salir antes del cumpleaños — hasta ese día el paciente sigue siendo del hospital de niños',
      );
    }
    if (context.counterReferralStatus === 'SENT') {
      throw new ConflictException('La carta de este paciente ya fue enviada');
    }

    const storagePath = await this.storageService.save(
      patientId,
      file.originalname,
      file.buffer,
    );

    let counterReferral = await this.counterReferralRepository.findOne({
      where: { patientId },
    });
    const now = new Date();
    if (counterReferral) {
      counterReferral.status = CounterReferralStatus.UPLOADED;
      counterReferral.fileName = file.originalname;
      counterReferral.format = dto.format;
      counterReferral.fileSize = file.size;
      counterReferral.storagePath = storagePath;
      counterReferral.code = dto.code ?? null;
      counterReferral.uploadedById = currentUserId;
      counterReferral.uploadedAt = now;
      counterReferral.sentById = null;
      counterReferral.sentAt = null;
      counterReferral.updatedAt = now;
      counterReferral.updatedById = currentUserId;
    } else {
      counterReferral = this.counterReferralRepository.create({
        patientId,
        status: CounterReferralStatus.UPLOADED,
        fileName: file.originalname,
        format: dto.format,
        fileSize: file.size,
        storagePath,
        code: dto.code ?? null,
        uploadedById: currentUserId,
        uploadedAt: now,
        sentById: null,
        sentAt: null,
        createdAt: now,
        createdById: currentUserId,
      });
    }
    const saved = await this.counterReferralRepository.save(counterReferral);
    await this.patientTransitionService.setCounterReferralStatus(
      patientId,
      CounterReferralStatus.UPLOADED,
      currentUserId,
    );
    return this.toResultDto(patientId, saved);
  }

  async deliver(
    patientId: number,
    currentUserId: number,
  ): Promise<CounterReferralResultDto> {
    const counterReferral = await this.getOrFail(patientId);
    const context =
      await this.patientTransitionService.getRuleContext(patientId);
    if (
      !context.isAdult ||
      counterReferral.status !== CounterReferralStatus.UPLOADED
    ) {
      throw new ConflictException(
        'Solo se puede enviar una carta ya subida, de un paciente que ya cumplió 18',
      );
    }

    counterReferral.status = CounterReferralStatus.SENT;
    counterReferral.sentById = currentUserId;
    counterReferral.sentAt = new Date();
    counterReferral.updatedAt = new Date();
    counterReferral.updatedById = currentUserId;
    const saved = await this.counterReferralRepository.save(counterReferral);
    await this.patientTransitionService.setCounterReferralStatus(
      patientId,
      CounterReferralStatus.SENT,
      currentUserId,
    );
    return this.toResultDto(patientId, saved);
  }

  private async getOrFail(patientId: number): Promise<CounterReferral> {
    const counterReferral = await this.counterReferralRepository.findOne({
      where: { patientId },
    });
    if (!counterReferral) {
      throw new NotFoundException(
        'Todavía no se subió una carta de contrarreferencia para este paciente',
      );
    }
    return counterReferral;
  }

  private extensionOf(fileName: string): string {
    const lastDot = fileName.lastIndexOf('.');
    return lastDot === -1 ? '' : fileName.slice(lastDot).toLowerCase();
  }

  private async resolveNames(userIds: number[]): Promise<Map<number, string>> {
    const ids = [...new Set(userIds)];
    if (ids.length === 0) {
      return new Map();
    }
    const users = await this.userRepository.find({ where: { id: In(ids) } });
    return new Map(
      users.map((u) => [u.id, `${u.firstName} ${u.lastName}`.trim()]),
    );
  }

  /** Junta el documento con la fila del paciente — ver CounterReferralResultDto sobre por qué van juntos. */
  private async toResultDto(
    patientId: number,
    counterReferral: CounterReferral,
  ): Promise<CounterReferralResultDto> {
    const [patient, nameById] = await Promise.all([
      this.patientTransitionService.findDetail(patientId),
      this.resolveNames(
        counterReferral.sentById !== null
          ? [counterReferral.uploadedById, counterReferral.sentById]
          : [counterReferral.uploadedById],
      ),
    ]);
    return {
      patient,
      counterReferral: this.toResponseDto(counterReferral, nameById),
    };
  }

  private toResponseDto(
    counterReferral: CounterReferral,
    nameById?: Map<number, string>,
  ): CounterReferralResponseDto {
    return {
      patientId: String(counterReferral.patientId),
      status: counterReferral.status,
      fileName: counterReferral.fileName,
      format: counterReferral.format,
      fileSize: counterReferral.fileSize,
      code: counterReferral.code,
      uploadedBy: nameById?.get(counterReferral.uploadedById) ?? '',
      uploadedAt: counterReferral.uploadedAt.toISOString(),
      sentBy:
        counterReferral.sentById !== null
          ? (nameById?.get(counterReferral.sentById) ?? null)
          : null,
      sentAt: counterReferral.sentAt
        ? counterReferral.sentAt.toISOString()
        : null,
    };
  }
}
