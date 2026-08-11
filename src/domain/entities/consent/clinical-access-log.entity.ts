import {
  Column,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AuthorizationScope } from '../../enums/authorization-scope.enum';

/**
 * La bitácora de accesos que exige la trazabilidad de la NTS 139-MINSA:
 * cada vez que un centro de salud consulta el resumen clínico de un
 * paciente (autorizado o vía excepción de emergencia), queda una fila
 * acá — se escribe SIEMPRE, incluso cuando el acceso se deniega
 * ("Granted = false"), para poder auditar intentos.
 *
 * Deliberadamente separado de "Audit" (esa tabla es para cambios
 * administrativos de rol/permiso vía trigger, OWASP A09 — esto es
 * lectura de datos de salud, un requisito legal propio, no un efecto
 * colateral de INSERT/UPDATE/DELETE). Mismo patrón "liviano" que
 * "UserLoginHistory": sin CreatedById/UpdatedAt/UpdatedById porque no
 * tiene sentido "editar" un acceso ya ocurrido, pero sí con
 * DeletedAt/DeletedById/RowVersion por consistencia con el resto del
 * esquema.
 */
@Entity('ClinicalAccessLog')
export class ClinicalAccessLog {
  @PrimaryGeneratedColumn({ name: 'Id' })
  id: number;

  @Column({ name: 'PatientId', type: 'int' })
  patientId: number;

  @Column({ name: 'AccessedByUserId', type: 'int' })
  accessedByUserId: number;

  @Column({ name: 'HealthFacilityId', type: 'int' })
  healthFacilityId: number;

  @Column({ name: 'AccessedAt', type: 'timestamp', precision: 6 })
  accessedAt: Date;

  @Column({ name: 'RequestedScope', type: 'varchar', length: 20 })
  requestedScope: AuthorizationScope;

  @Column({ name: 'Granted', type: 'boolean' })
  granted: boolean;

  @Column({ name: 'WasEmergencyOverride', type: 'boolean' })
  wasEmergencyOverride: boolean;

  @Column({
    name: 'DenialReason',
    type: 'varchar',
    length: 300,
    nullable: true,
  })
  denialReason: string | null;

  @Column({ name: 'IpAddress', type: 'varchar', length: 45, nullable: true })
  ipAddress: string | null;

  @DeleteDateColumn({ name: 'DeletedAt', type: 'timestamp', precision: 6 })
  deletedAt: Date | null;

  @Column({ name: 'DeletedById', type: 'int', nullable: true })
  deletedById: number | null;

  @Column({ name: 'RowVersion', type: 'bigint', update: false })
  rowVersion: string;
}
