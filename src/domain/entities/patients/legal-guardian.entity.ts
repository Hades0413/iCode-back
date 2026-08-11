import { Column, Entity } from 'typeorm';
import { AuditableEntity } from '../base/auditable.entity';
import { RelationshipType } from '../../enums/relationship-type.enum';

/**
 * Vínculo entre un tutor (su propia cuenta "User", con la que inicia
 * sesión) y el paciente menor que representa. Nombre/documento del tutor
 * NO se duplican aquí: se leen de "User" vía "UserId" — este registro
 * solo agrega lo que "User" no sabe (de qué paciente es tutor, con qué
 * vínculo, si sigue vigente).
 *
 * "IsActive" es la mitad "semi-automática" del traspaso de titularidad a
 * los 18 (ver TitleTransferService): al cumplir el paciente la mayoría de
 * edad, todos sus tutores pasan a IsActive=false y dejan de poder
 * autorizar accesos — sin borrar el vínculo histórico.
 */
@Entity('LegalGuardian')
export class LegalGuardian extends AuditableEntity {
  @Column({ name: 'PatientId', type: 'int' })
  patientId: number;

  @Column({ name: 'UserId', type: 'int' })
  userId: number;

  @Column({ name: 'RelationshipType', type: 'varchar', length: 20 })
  relationshipType: RelationshipType;

  @Column({ name: 'IsPrimary', type: 'boolean' })
  isPrimary: boolean;

  @Column({ name: 'IsActive', type: 'boolean' })
  isActive: boolean;

  @Column({
    name: 'DeactivatedAt',
    type: 'timestamp',
    precision: 6,
    nullable: true,
  })
  deactivatedAt: Date | null;
}
