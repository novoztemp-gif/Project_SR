import { Section } from '@prisma/client'

/** Capitalized process labels used by the frontend Counter UI. */
export type SectionType = 'Glass & Plywood' | 'Plumbing' | 'Painting' | 'Electrical' | 'Hardware'

export const ALL_SECTIONS: Section[] = [
  Section.glass_plywood,
  Section.plumbing,
  Section.painting,
  Section.electrical,
  Section.hardware,
]

const TYPE_BY_SECTION: Record<Section, SectionType> = {
  glass_plywood: 'Glass & Plywood',
  plumbing: 'Plumbing',
  painting: 'Painting',
  electrical: 'Electrical',
  hardware: 'Hardware',
}

const SECTION_BY_TYPE: Record<SectionType, Section> = {
  'Glass & Plywood': Section.glass_plywood,
  Plumbing: Section.plumbing,
  Painting: Section.painting,
  Electrical: Section.electrical,
  Hardware: Section.hardware,
}

export function sectionToType(section: Section): SectionType {
  return TYPE_BY_SECTION[section]
}

export function typeToSection(type: SectionType): Section {
  return SECTION_BY_TYPE[type]
}

export function processToSections(process: SectionType[]): Section[] {
  return process.map(typeToSection)
}

export function sectionsToProcess(sections: Section[]): SectionType[] {
  return sections.map(sectionToType)
}

/** Sections a user may access: admins get everything, others get their processes. */
export function allowedSectionsForUser(user: { role: string; processes: Section[] }): Section[] {
  return user.role === 'admin' ? ALL_SECTIONS : user.processes
}
