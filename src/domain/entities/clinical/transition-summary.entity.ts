import { Column, Entity } from 'typeorm';
import { AuditableEntity } from '../base/auditable.entity';
import { ClinicalSummaryStatus } from '../../enums/clinical-summary-status.enum';
import { SummaryAuthorKind } from '../../enums/summary-author-kind.enum';

export interface TransitionSummarySection {
  id: string;
  title: string;
  body: string;
  hint: string;
}

/**
 * La historia clínica de transferencia ("las 2 hojas") — documento con
 * ciclo de vida propio (borrador de IA → revisión → firma), NO el mismo
 * concepto que el resumen que consulta una IPRESS vía "AccessDecisionService"
 * (ese se arma al vuelo desde "ClinicalRecord" y no se persiste). Nombrado
 * "TransitionSummary" y no "ClinicalSummary" a propósito, para que no se
 * confundan ni en el código ni en una conversación — ver
 * PUENTE18_FRONTEND_INTEGRATION.md, sección 3.
 *
 * Es 1:1 con "Patient" (una sola vigente a la vez, "UQ_TransitionSummary_Patient"):
 * "NONE" (todavía no se generó nada) no es un valor de "Status", es que la
 * fila no existe — ver TransitionSummaryService.findByPatient.
 */
@Entity('TransitionSummary')
export class TransitionSummary extends AuditableEntity {
  @Column({ name: 'PatientId', type: 'int' })
  patientId: number;

  @Column({ name: 'Status', type: 'varchar', length: 10 })
  status: ClinicalSummaryStatus;

  @Column({ name: 'Sections', type: 'jsonb' })
  sections: TransitionSummarySection[];

  @Column({ name: 'PendingChecks', type: 'jsonb', nullable: true })
  pendingChecks: string[] | null;

  @Column({ name: 'DraftedByKind', type: 'varchar', length: 10 })
  draftedByKind: SummaryAuthorKind;

  @Column({ name: 'DraftedByName', type: 'varchar', length: 150 })
  draftedByName: string;

  @Column({ name: 'DraftedAt', type: 'timestamp', precision: 6 })
  draftedAt: Date;

  @Column({ name: 'EditedById', type: 'int', nullable: true })
  editedById: number | null;

  @Column({ name: 'EditedAt', type: 'timestamp', precision: 6, nullable: true })
  editedAt: Date | null;

  @Column({ name: 'ApprovedById', type: 'int', nullable: true })
  approvedById: number | null;

  @Column({
    name: 'ApprovedAt',
    type: 'timestamp',
    precision: 6,
    nullable: true,
  })
  approvedAt: Date | null;
}
