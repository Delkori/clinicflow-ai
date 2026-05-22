export type UserRole = 'medecin' | 'assistant'
export type PatientSource = 'manual' | 'doctolib' | 'other'
export type ConsultationStatus = 'draft' | 'completed' | 'validated'
export type AppointmentStatus = 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no_show'
export type AppointmentType = 'consultation' | 'intervention' | 'suivi' | 'control'
export type WorkflowStepType = 'email' | 'whatsapp' | 'document' | 'docusign' | 'sms'
export type DocumentType = 'rapport_medical' | 'devis' | 'consentement' | 'pre_op' | 'post_op' | 'other'
export type ExecutionStatus = 'pending' | 'sent' | 'failed' | 'skipped'

export interface Clinic {
  id: string
  name: string
  owner_id: string
  created_at: string
}

export interface Profile {
  id: string
  clinic_id: string
  role: UserRole
  full_name: string | null
  email: string | null
  created_at: string
}

export interface Patient {
  id: string
  clinic_id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  date_of_birth: string | null
  source: PatientSource
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Treatment {
  id: string
  clinic_id: string
  name: string
  description: string | null
  color: string
  created_at: string
}

export interface Workflow {
  id: string
  treatment_id: string
  clinic_id: string
  name: string
  is_active: boolean
  created_at: string
  treatment?: Treatment
  steps?: WorkflowStep[]
}

export interface WorkflowStep {
  id: string
  workflow_id: string
  step_order: number
  type: WorkflowStepType
  timing_days: number
  timing_reference: 'consultation' | 'intervention' | 'custom'
  template_name: string | null
  template_subject: string | null
  template_body: string | null
  is_active: boolean
  created_at: string
}

export interface Consultation {
  id: string
  patient_id: string
  clinic_id: string
  treatment_id: string | null
  audio_url: string | null
  transcription: string | null
  structured_data: ConsultationStructuredData
  status: ConsultationStatus
  consultation_date: string
  created_at: string
  updated_at: string
  patient?: Patient
  treatment?: Treatment
}

export interface ConsultationStructuredData {
  motif_consultation?: string
  mode_de_vie?: string
  diagnostic?: string
  zone_donneuse?: string
  plan_de_traitement?: string
  antecedents?: string
  allergies?: string
  medicaments?: string
  notes?: string
}

export interface Appointment {
  id: string
  patient_id: string
  clinic_id: string
  treatment_id: string | null
  consultation_id: string | null
  appointment_date: string
  type: AppointmentType
  status: AppointmentStatus
  source: string
  notes: string | null
  created_at: string
  patient?: Patient
  treatment?: Treatment
}

export interface Document {
  id: string
  patient_id: string
  clinic_id: string
  consultation_id: string | null
  type: DocumentType
  name: string
  url: string | null
  status: 'draft' | 'sent' | 'signed' | 'archived'
  docusign_envelope_id: string | null
  created_at: string
}

export interface WorkflowExecution {
  id: string
  patient_id: string
  clinic_id: string
  workflow_id: string
  step_id: string
  consultation_id: string | null
  status: ExecutionStatus
  scheduled_at: string | null
  executed_at: string | null
  error_message: string | null
  created_at: string
  step?: WorkflowStep
  patient?: Patient
}

export interface DashboardStats {
  total_patients: number
  patients_this_month: number
  consultations_this_month: number
  pending_executions: number
  patients_by_treatment: Array<{ treatment_name: string; count: number; color: string }>
  recent_patients: Patient[]
}
