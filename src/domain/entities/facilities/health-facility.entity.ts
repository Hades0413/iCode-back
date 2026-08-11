import { Column, Entity } from 'typeorm';
import { AuditableEntity } from '../base/auditable.entity';

/**
 * Centro de salud (IPRESS) simulado — catálogo de referencia usado tanto
 * por "ClinicalRecord" (dónde se registró) como por "AccessAuthorization"
 * / "ClinicalAccessLog" (quién pide/otorga acceso). No hay integración
 * real con RENHICE en este prototipo: "RenhiceCode" es un código
 * ficticio que solo simula esa referencia (ver
 * prompt_contexto_backend_puente18.md, sección 3).
 */
@Entity('HealthFacility')
export class HealthFacility extends AuditableEntity {
  @Column({ name: 'Name', type: 'varchar', length: 200 })
  name: string;

  @Column({
    name: 'RenhiceCode',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  renhiceCode: string | null;

  @Column({ name: 'FacilityType', type: 'varchar', length: 20 })
  facilityType: string;

  @Column({ name: 'Address', type: 'varchar', length: 300, nullable: true })
  address: string | null;

  @Column({ name: 'State', type: 'boolean' })
  state: boolean;
}
