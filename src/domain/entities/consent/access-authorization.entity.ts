import { Column, Entity } from 'typeorm';
import { AuditableEntity } from '../base/auditable.entity';
import { AuthorizationScope } from '../../enums/authorization-scope.enum';
import { AuthorizationStatus } from '../../enums/authorization-status.enum';

/**
 * El consentimiento explícito que exige la Ley 29733 para tratar datos
 * clínicos: un paciente (o su tutor, mientras es titular — ver
 * TitleTransferService) autoriza a UN centro de salud a ver su
 * información BASICA, SENSIBLE o TODA. "GrantedByUserId" es quien firmó
 * la autorización — se valida en ConsentService que sea el titular vigente
 * al momento de otorgarla, no cualquier usuario.
 *
 * No hay excepción de emergencia acá: eso solo aplica a información
 * BASICA sin autorización previa (ver AccessDecisionService) y queda
 * registrado aparte en "ClinicalAccessLog", nunca como si fuera una fila
 * de esta tabla.
 */
@Entity('AccessAuthorization')
export class AccessAuthorization extends AuditableEntity {
  @Column({ name: 'PatientId', type: 'int' })
  patientId: number;

  @Column({ name: 'HealthFacilityId', type: 'int' })
  healthFacilityId: number;

  @Column({ name: 'GrantedByUserId', type: 'int' })
  grantedByUserId: number;

  @Column({ name: 'Scope', type: 'varchar', length: 20 })
  scope: AuthorizationScope;

  @Column({ name: 'Status', type: 'varchar', length: 20 })
  status: AuthorizationStatus;

  @Column({ name: 'GrantedAt', type: 'timestamp', precision: 6 })
  grantedAt: Date;

  @Column({
    name: 'RevokedAt',
    type: 'timestamp',
    precision: 6,
    nullable: true,
  })
  revokedAt: Date | null;

  @Column({
    name: 'ExpiresAt',
    type: 'timestamp',
    precision: 6,
    nullable: true,
  })
  expiresAt: Date | null;

  @Column({ name: 'Notes', type: 'varchar', length: 500, nullable: true })
  notes: string | null;
}
