import { Column, Entity } from 'typeorm';
import { AuditableEntity } from '../base/auditable.entity';

/**
 * A qué IPRESS pertenece un usuario de personal de salud. Tabla de unión
 * propia (1 fila por usuario, "UserId" único) en vez de una columna
 * "HealthFacilityId" en "User": así el esquema de identidad (creado en
 * CreateInitialSchema) nunca necesita un ALTER TABLE posterior para que
 * exista este dato — "HealthFacility" se crea después de "User" (su
 * "CreatedById" depende de que "User" ya exista, igual que toda tabla del
 * esquema), así que la única forma de evitar un ALTER era no tocar "User"
 * en absoluto. Ver migrations/README.md.
 */
@Entity('HealthFacilityStaff')
export class HealthFacilityStaff extends AuditableEntity {
  @Column({ name: 'UserId', type: 'int' })
  userId: number;

  @Column({ name: 'HealthFacilityId', type: 'int' })
  healthFacilityId: number;
}
