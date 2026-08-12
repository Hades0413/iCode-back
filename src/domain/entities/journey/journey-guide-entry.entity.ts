import { Column, Entity } from 'typeorm';
import { AuditableEntity } from '../base/auditable.entity';

/** Preguntas frecuentes genéricas de "Mi recorrido" — catálogo global, no por paciente. */
@Entity('JourneyGuideEntry')
export class JourneyGuideEntry extends AuditableEntity {
  @Column({ name: 'Question', type: 'varchar', length: 300 })
  question: string;

  @Column({ name: 'Answer', type: 'varchar', length: 2000 })
  answer: string;

  @Column({ name: 'DisplayOrder', type: 'int' })
  displayOrder: number;

  @Column({ name: 'State', type: 'boolean' })
  state: boolean;
}
