// Tipos TypeScript que reflejan los DTOs/entidades del backend Wapi (.NET).

export interface Tenant {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
}

export interface ApiKeyCreated {
  id: string;
  name: string;
  prefix: string;
  key: string; // clave en claro, solo al crear
  createdAt: string;
}

export interface TenantCreated {
  tenant: Tenant;
  defaultApiKey: ApiKeyCreated;
}

/**
 * Canal de la cuenta. Instagram y Messenger van por la Send API: no admiten plantillas,
 * interactivos, reacciones, ubicaciones ni productos.
 */
export type MessagingChannel = 'whatsapp' | 'instagram' | 'messenger';

export const CHANNEL_LABELS: Record<MessagingChannel, string> = {
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  messenger: 'Messenger',
};

/** True si el canal admite plantillas aprobadas. Solo WhatsApp. */
export const supportsTemplates = (channel: MessagingChannel | undefined) =>
  (channel ?? 'whatsapp') === 'whatsapp';

export interface Account {
  id: string;
  tenantId: string;
  channel: MessagingChannel;
  displayName: string;
  wabaId: string;
  /** En Instagram y Messenger, el id de la página o cuenta profesional. */
  phoneNumberId: string;
  displayPhoneNumber: string;
  webhookVerifyToken?: string | null;
  /** Cuenta de pruebas: nada sale hacia Meta y los entrantes se simulan. */
  isSandbox: boolean;
  isActive: boolean;
  createdAt: string;
}

/** Mensaje entrante simulado. Con `buttonId` llega como respuesta de botón de un menú. */
export interface SandboxInboundRequest {
  from: string;
  text?: string;
  profileName?: string;
  buttonId?: string;
}

export type SandboxStatus = 'sent' | 'delivered' | 'read' | 'failed';

export interface CreateAccountRequest {
  /** Por defecto whatsapp. */
  channel?: MessagingChannel;
  displayName: string;
  /** Solo obligatorio en WhatsApp. */
  wabaId?: string;
  phoneNumberId: string;
  displayPhoneNumber?: string;
  accessToken: string;
  /** Solo obligatorio en WhatsApp: los otros canales usan el webhook común. */
  webhookVerifyToken?: string;
  appSecret?: string | null;
}

/** Permisos que puede llevar un rol (ver `Permissions` en el backend). */
export const PERMISSIONS = [
  'accounts.manage',
  'users.manage',
  'apikeys.manage',
  'plan.view',
  'audit.view',
  'messages.send',
  'contacts.view',
  'contacts.manage',
  'contacts.export',
  'queues.manage',
  'flows.manage',
  'campaigns.manage',
  'knowledge.manage',
  'aifunctions.manage',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export interface Role {
  id: string;
  tenantId: string;
  name: string;
  description?: string | null;
  /** Ya normalizados por el backend: los inventados se descartan al guardar. */
  permissions: string[];
}

/** Cambios sobre un rol. Lo que no se envía se deja como está; `permissions` reemplaza la lista. */
export interface UpdateRoleRequest {
  name?: string;
  description?: string;
  permissions?: string[];
}

export interface User {
  id: string;
  tenantId: string;
  email: string;
  fullName?: string | null;
  roleId?: string | null;
  roleName?: string | null;
  isActive: boolean;
  createdAt: string;
  lastLoginAt?: string | null;
}

export interface CreateUserRequest {
  email: string;
  password: string;
  fullName?: string;
  roleId?: string | null;
}

export interface ApiKeyView {
  id: string;
  name: string;
  prefix: string;
  isActive: boolean;
  createdAt: string;
  lastUsedAt?: string | null;
  revokedAt?: string | null;
}

export type MessageDirection = 0 | 1; // Inbound=0, Outbound=1
/** Pending, Sent, Delivered, Read, Failed, Received, Queued. */
export type MessageStatus = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface Message {
  id: string;
  whatsAppAccountId: string;
  waMessageId?: string | null;
  direction: MessageDirection;
  from: string;
  to: string;
  type: string;
  body?: string | null;
  mediaId?: string | null;
  mediaMimeType?: string | null;
  mediaFilename?: string | null;
  mediaStorageKey?: string | null;
  status: MessageStatus;
  errorMessage?: string | null;
  createdAt: string;
  statusUpdatedAt?: string | null;
}

export interface SendTextRequest {
  to: string;
  text: string;
  previewUrl?: boolean;
  /** wamid del mensaje al que responde: WhatsApp lo muestra citado encima. */
  replyToMessageId?: string;
}

/** Cabecera variable de una plantilla: texto, o media por URL (`link`) o por `mediaId`. */
export interface TemplateHeader {
  type: 'text' | 'image' | 'video' | 'document';
  text?: string;
  link?: string;
  mediaId?: string;
  /** Nombre con el que se muestra el archivo. Solo para documentos. */
  filename?: string;
}

/** Valor de un botón dinámico. `index` es la posición del botón en la plantilla, desde 0. */
export interface TemplateButtonParameter {
  index: number;
  subType: 'url' | 'quick_reply' | 'copy_code';
  value: string;
}

/** Tarjeta de un carrusel, en el orden con el que se aprobó la plantilla. */
export interface TemplateCarouselCard {
  index: number;
  /** Siempre imagen o vídeo, nunca texto. */
  header?: TemplateHeader;
  bodyParameters?: string[];
  buttons?: TemplateButtonParameter[];
}

export interface SendTemplateRequest {
  to: string;
  templateName: string;
  languageCode: string;
  /** Parámetros posicionales. Alternativo a `namedBodyParameters`, nunca ambos. */
  bodyParameters: string[];
  /** Parámetros con nombre ({{nombre}}), el formato nuevo de Meta. */
  namedBodyParameters?: Record<string, string>;
  header?: TemplateHeader;
  buttons?: TemplateButtonParameter[];
  carousel?: TemplateCarouselCard[];
  /** Caducidad de una plantilla de oferta limitada: WhatsApp muestra la cuenta atrás. */
  offerExpiresAt?: string;
}

export interface SendMediaLinkRequest {
  to: string;
  type: string;
  link: string;
  caption?: string;
  filename?: string;
  replyToMessageId?: string;
}

/** Envío de un objeto ya guardado en el almacenamiento del tenant. */
export interface SendMediaFromStorageRequest {
  to: string;
  type: string;
  /** Clave del objeto en el almacenamiento. */
  key: string;
  mimeType?: string;
  caption?: string;
  filename?: string;
  replyToMessageId?: string;
}

export interface SendLocationRequest {
  to: string;
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
  replyToMessageId?: string;
}

export interface SendReactionRequest {
  to: string;
  /** wamid del mensaje al que se reacciona. */
  messageId: string;
  /** Emoji; cadena vacía retira la reacción anterior. */
  emoji: string;
}

export interface ContactCardName {
  formattedName: string;
  firstName?: string;
  lastName?: string;
  middleName?: string;
  prefix?: string;
  suffix?: string;
}

/** Ficha de contacto compartida (vCard). Meta exige `formattedName` y algún otro campo. */
export interface ContactCard {
  name: ContactCardName;
  phones?: { phone: string; type?: string; waId?: string }[];
  emails?: { email: string; type?: string }[];
  birthday?: string;
  org?: { company?: string; department?: string; title?: string };
  urls?: { url: string; type?: string }[];
  addresses?: {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
    countryCode?: string;
    type?: string;
  }[];
}

export interface SendContactsRequest {
  to: string;
  contacts: ContactCard[];
  replyToMessageId?: string;
}

/** Formulario nativo (WhatsApp Flow). La respuesta llega como un entrante `nfm_reply`. */
export interface SendFlowRequest {
  to: string;
  flowId: string;
  body: string;
  buttonText: string;
  header?: string;
  footer?: string;
  screenName?: string;
  initialData?: Record<string, unknown>;
  flowToken?: string;
  flowAction?: 'navigate' | 'data_exchange';
  replyToMessageId?: string;
}

/** Un producto envía su ficha; varios, un listado por secciones. */
export interface SendProductRequest {
  to: string;
  catalogId: string;
  productRetailerIds: string[];
  body?: string;
  header?: string;
  footer?: string;
  sectionTitle?: string;
  replyToMessageId?: string;
}

export interface SendMessageResult {
  messageId: string;
  waMessageId?: string | null;
  status: string;
}

/** Estado de un envío, sobre todo de los encolados con `?async=true`. */
export interface MessageStatusView {
  messageId: string;
  waMessageId?: string | null;
  /** pending | queued | sent | delivered | read | failed | received. */
  status: string;
  error?: string | null;
  attempts: number;
  nextAttemptAt?: string | null;
  createdAt: string;
  statusUpdatedAt?: string | null;
}

/** Fila del buscador de mensajes: subconjunto del historial. */
export interface MessageSearchHit {
  id: string;
  waMessageId?: string | null;
  direction: MessageDirection;
  from: string;
  to: string;
  type: string;
  body?: string | null;
  status: MessageStatus;
  createdAt: string;
}

export interface MessageSearchParams {
  q?: string;
  waId?: string;
  direction?: 'inbound' | 'outbound';
  /** Fechas ISO 8601. */
  from?: string;
  to?: string;
  skip?: number;
  take?: number;
}

/** Opciones de entrega comunes a todos los envíos. */
export interface SendOptions {
  /** Responde 202 y entrega un worker; el estado se consulta en `/messages/{id}/status`. */
  async?: boolean;
  /** Fecha ISO futura. Implica encolar. */
  scheduleAt?: string;
}

export interface AccountStat {
  accountId: string;
  displayName: string;
  messages: number;
  inbound: number;
  outbound: number;
}

/** Un día de la serie, con el reparto por dirección. */
export interface DailyStat {
  /** yyyy-MM-dd (UTC). */
  date: string;
  inbound: number;
  outbound: number;
  total: number;
}

export interface StatisticsSummary {
  accounts: number;
  contacts: number;
  totalMessages: number;
  inbound: number;
  outbound: number;
  byStatus: Record<string, number>;
  /** Serie diaria con el total. Se mantiene por compatibilidad; para pintar usa `daily`. */
  lastDays: Record<string, number>;
  /** Serie diaria separada por dirección. Incluye los días sin tráfico, con ceros. */
  daily: DailyStat[];
  accounts_Breakdown: AccountStat[];
}

export interface SubscriptionResponse {
  id: string;
  url: string;
  events: string[];
  isActive: boolean;
  createdAt: string;
  lastDeliveryAt?: string | null;
  lastDeliveryStatus?: string | null;
  secret?: string | null;
}

export interface CreateSubscriptionRequest {
  url: string;
  secret?: string;
  events: string[];
}

export interface SessionResponse {
  id: string;
  waId: string;
  flowId?: string | null;
  currentNodeKey?: string | null;
  status: string;
  variables: Record<string, string>;
  updatedAt: string;
}

export interface FlowOptionDto {
  label: string;
  description?: string | null;
  action: string; // navigate | message | handoff | webhook | close | queue
  targetNodeKey?: string | null;
  messageText?: string | null;
  webhookUrl?: string | null;
  targetQueueKey?: string | null;
  /** Etiquetas que se ponen al contacto al elegir esta opción. Admiten `{{variable}}`. */
  autoTags?: string[];
}

export type FlowActionType = 'webhook' | 'task';
export type ContactTaskPriority = 'low' | 'normal' | 'high' | 'urgent';
export type ContactTaskStatus = 'pending' | 'inprogress' | 'done' | 'cancelled';

/** Acción de un nodo. Todos los textos admiten `{{variable}}`. */
export interface FlowActionDto {
  type: FlowActionType;
  isEnabled: boolean;
  /** Nombre con el que se ve en el editor. No lo ve el contacto. */
  name?: string | null;

  // Webhook
  url?: string | null;
  /** POST (por defecto) o PUT. */
  method?: string | null;
  /** Cabeceras extra como objeto JSON: aquí van las claves del sistema receptor. */
  headersJson?: string | null;
  /** Cuerpo a medida con variables. Vacío = payload estándar del motor. */
  bodyTemplate?: string | null;

  // Tarea
  taskTitle?: string | null;
  taskDescription?: string | null;
  taskPriority?: ContactTaskPriority | null;
  taskDueInHours?: number | null;
  taskAssignedUserId?: string | null;
}

/** Trabajo pendiente asociado a un contacto. Lo crea el flujo o una persona desde la ficha. */
export interface ContactTask {
  id: string;
  contactId: string;
  title: string;
  description?: string | null;
  status: ContactTaskStatus;
  priority: ContactTaskPriority;
  dueAt?: string | null;
  /** Tenía fecha, ya pasó y sigue abierta. */
  isOverdue: boolean;
  assignedUserId?: string | null;
  /** Flujo y nodo que la crearon. Null en las creadas a mano. */
  sourceFlowId?: string | null;
  sourceNodeKey?: string | null;
  createdByUserId?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  /** Solo en el listado global. */
  waId?: string | null;
  contactName?: string | null;
}

export interface ContactTaskRequest {
  title?: string;
  description?: string | null;
  status?: ContactTaskStatus;
  priority?: ContactTaskPriority;
  dueAt?: string | null;
  assignedUserId?: string | null;
}

export interface FlowNodeDto {
  key: string;
  type: string; // menu | message | capture | ai
  body: string;
  header?: string | null;
  footer?: string | null;
  listButtonText?: string | null;
  captureVariable?: string | null;
  /**
   * Etiquetas que se ponen al contacto al completar el nodo. Admiten `{{variable}}`; si una
   * variable no tiene valor, esa etiqueta se descarta entera en vez de quedar a medias.
   */
  autoTags?: string[];
  /**
   * Lo que se dispara al completar el nodo: avisos a sistemas externos y tareas para el equipo.
   * Se ejecutan en el orden de la lista y de forma aislada: si una falla, las demás siguen.
   */
  actions?: FlowActionDto[];
  nextNodeKey?: string | null;
  /** Solo para nodos tipo "ai". */
  aiSystemPrompt?: string | null;
  aiModel?: string | null;
  escalationKeywords?: string[];
  escalationQueueKey?: string | null;
  /** Consultar la base de conocimiento del tenant antes de responder. */
  useKnowledgeBase?: boolean;
  /** Dejar que el bot ejecute las funciones del tenant en vez de escalar. */
  useFunctions?: boolean;
  options: FlowOptionDto[];
}

export interface FlowResponse {
  id: string;
  accountId: string;
  name: string;
  triggerKeywords: string[];
  isDefault: boolean;
  isEnabled: boolean;
  entryNodeKey: string;
  nodes: FlowNodeDto[];
  createdAt: string;
  updatedAt: string;
}

export interface LoginRequest {
  /** Opcional: si se omite, el backend resuelve el tenant por el email. */
  tenantId?: string;
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  expiresAt: string;
  /** Se canjea en `/api/auth/refresh` por una sesión nueva. Cada canje lo invalida. */
  refreshToken: string;
  /** Hasta cuándo se puede renovar: es el tope real de la sesión. */
  refreshExpiresAt: string;
  user: User;
}

export interface RegisterRequest {
  organizationName: string;
  email: string;
  password: string;
  fullName?: string;
}

export interface RegisterResponse {
  token: string;
  expiresAt: string;
  refreshToken: string;
  refreshExpiresAt: string;
  user: User;
  tenant: Tenant;
  defaultApiKey: ApiKeyCreated;
}

// ---- Colas de atención ----

export interface QueueMember {
  userId: string;
  email: string;
  fullName?: string | null;
  roleName?: string | null;
  isActive: boolean;
  /** Conversaciones asignadas ahora mismo a este agente en esta cola. */
  assignedCount: number;
}

/**
 * Tramo de atención. Si `close` es menor o igual que `open`, el tramo cruza la medianoche
 * (22:00 → 02:00).
 */
export interface BusinessHourSlot {
  /** 0 = domingo … 6 = sábado. */
  dayOfWeek: number;
  /** HH:mm */
  open: string;
  /** HH:mm */
  close: string;
}

/** Ajustes de operación comunes al alta y a la edición de una cola. */
export interface QueueOperationSettings {
  /** Zona horaria IANA, ej. "America/Costa_Rica". Vacío = UTC. */
  timeZoneId?: string | null;
  outOfHoursMessage?: string | null;
  /** Minutos de plazo para la primera respuesta. 0 o null desactiva el control. */
  slaFirstResponseMinutes?: number | null;
  csatEnabled?: boolean;
  csatQuestion?: string | null;
  /** Lista completa: reemplaza los tramos anteriores. Omitir = no tocar. */
  businessHours?: BusinessHourSlot[];
}

export interface Queue extends QueueOperationSettings {
  id: string;
  key: string;
  name: string;
  autoAssign: boolean;
  members: QueueMember[];
  waitingCount: number;
  assignedCount: number;
  csatEnabled: boolean;
  /** Lista vacía = la cola atiende siempre. */
  businessHours: BusinessHourSlot[];
  createdAt: string;
}

export interface CreateQueueRequest extends QueueOperationSettings {
  key: string;
  name: string;
  autoAssign: boolean;
  memberUserIds?: string[];
}

/** El `key` no es editable; `memberUserIds` reemplaza la lista completa (null = no tocar). */
export interface UpdateQueueRequest extends QueueOperationSettings {
  name?: string;
  autoAssign?: boolean;
  memberUserIds?: string[];
}

// ---- Respuestas rápidas ----

export interface QuickReply {
  id: string;
  shortcut: string;
  title: string;
  /** Admite {{nombre}}, {{telefono}}, {{empresa}}, {{email}} y {{cuenta}}. */
  body: string;
  category?: string | null;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface QuickReplyRequest {
  shortcut: string;
  title: string;
  body: string;
  category?: string;
}

// ---- Métricas del equipo ----

/** Media, mediana y p90: la media sola la dispara una conversación olvidada un fin de semana. */
export interface DurationStats {
  count: number;
  average: number;
  median: number;
  p90: number;
  max: number;
}

export interface TeamMetrics {
  desde: string;
  days: number;
  total: number;
  waiting: number;
  assigned: number;
  closed: number;
  /** Entró, nadie respondió y sigue abierta. */
  unanswered: number;
  outOfHours: number;
  firstResponseSeconds?: DurationStats | null;
  resolutionSeconds?: DurationStats | null;
  slaBreached: number;
  slaCompliance?: number | null;
  csat: {
    sent: number;
    answered: number;
    averageScore?: number | null;
    responseRate?: number | null;
  };
}

export interface AgentMetrics {
  userId: string;
  email?: string | null;
  assigned: number;
  closed: number;
  open: number;
  firstResponseSeconds?: DurationStats | null;
  resolutionSeconds?: DurationStats | null;
  averageCsat?: number | null;
}

export interface SlaBreach {
  id: string;
  queueId: string;
  waId: string;
  status: number;
  createdAt: string;
  slaBreachedAt: string;
  assignedUserId?: string | null;
  waitingMinutes: number;
}

/** Conversaciones facturables de Meta. No lleva importes: dependen del país y la tarifa. */
export interface BillingUsage {
  desde: string;
  days: number;
  totalConversations: number;
  billableConversations: number;
  freeConversations: number;
  byCategory: { category: string; conversations: number; billable: number; free: number }[];
  byAccount: {
    accountId: string;
    displayName?: string | null;
    phoneNumber?: string | null;
    conversations: number;
    billable: number;
  }[];
  note: string;
}

// ---- Campañas ----

export type CampaignStatusName =
  | 'draft'
  | 'scheduled'
  | 'running'
  | 'paused'
  | 'completed'
  | 'cancelled';

/** Segmento por etiquetas. `matchAllTags` exige todas las incluidas; si no, basta una. */
export interface CampaignSegment {
  includeTags?: string;
  excludeTags?: string;
  matchAllTags: boolean;
}

export interface Campaign {
  id: string;
  accountId: string;
  name: string;
  templateName: string;
  languageCode: string;
  status: CampaignStatusName;
  segmentId?: string | null;
  segment: CampaignSegment;
  scheduledAt?: string | null;
  progress: { total: number; sent: number; failed: number; skipped: number; pending: number };
  createdAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
}

export interface CampaignPreviewRequest extends Partial<CampaignSegment> {
  accountId: string;
  /** Si se indica, sus criterios mandan sobre las etiquetas sueltas. */
  segmentId?: string;
}

// ---- Segmentos guardados ----

/** Criterios de un segmento. Es una consulta viva: quien empiece a cumplirlos entra solo. */
export interface SegmentFilters {
  includeTags?: string;
  excludeTags?: string;
  matchAllTags: boolean;
  /** true = solo con la ventana de 24 h abierta; false = solo cerrada. */
  windowOpen?: boolean | null;
  /** true = solo con correo; false = solo sin correo. */
  hasEmail?: boolean | null;
  company?: string | null;
  /** Solo quien haya escrito en los últimos N días. */
  activeWithinDays?: number | null;
}

export interface Segment extends SegmentFilters {
  id: string;
  accountId: string;
  name: string;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SegmentRequest extends SegmentFilters {
  accountId: string;
  name: string;
  description?: string;
}

export interface SegmentPreview {
  total: number;
  sample: { waId: string; name?: string | null; company?: string | null; tags: string[] }[];
  note: string;
}

/** Los contactos de baja o bloqueados quedan siempre fuera del alcance. */
export interface CampaignPreview {
  total: number;
  sample: { waId: string; name?: string | null; tags: string[] }[];
  note: string;
}

export interface CreateCampaignRequest extends Partial<CampaignSegment> {
  accountId: string;
  /** Segmento guardado; manda sobre las etiquetas sueltas. */
  segmentId?: string;
  name: string;
  templateName: string;
  languageCode?: string;
  /** Contenido de la plantilla; el `to` se ignora, lo pone cada destinatario. */
  template?: Omit<SendTemplateRequest, 'to'>;
}

export type CampaignRecipientStatus = 'pending' | 'sent' | 'failed' | 'skipped';

export interface CampaignRecipient {
  waId: string;
  status: CampaignRecipientStatus;
  messageId?: string | null;
  error?: string | null;
  sentAt?: string | null;
}

// ---- IA: base de conocimiento y funciones ----

export interface KnowledgeDocument {
  id: string;
  title: string;
  source?: string | null;
  isEnabled: boolean;
  indexedAt?: string | null;
  /** Si viene, el indexado falló y el documento no se consulta. */
  indexError?: string | null;
  /** Solo en el listado. */
  chunks?: number;
  length: number;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeDocumentRequest {
  title: string;
  content?: string;
  source?: string;
  isEnabled?: boolean;
}

export interface KnowledgeSearchHit {
  text: string;
  document: string;
  score: number;
}

export interface AiFunction {
  id: string;
  name: string;
  description: string;
  parametersJsonSchema: string;
  url: string;
  method: 'GET' | 'POST';
  /** Las cabeceras no se devuelven: suelen llevar el token del sistema del cliente. */
  hasHeaders: boolean;
  timeoutSeconds: number;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AiFunctionRequest {
  /** Sin espacios: es como la pide el modelo. */
  name: string;
  description: string;
  parametersJsonSchema?: string;
  url: string;
  method?: 'GET' | 'POST';
  /** Se guardan cifradas y no se devuelven. */
  headers?: Record<string, string>;
  timeoutSeconds?: number;
  isEnabled?: boolean;
}

// ---- Plan, consumo y auditoría ----

export interface TenantPlan {
  name: string;
  monthlyMessageLimit?: number | null;
  maxAccounts?: number | null;
  maxUsers?: number | null;
  maxKnowledgeDocuments?: number | null;
  /** False registra el exceso pero no bloquea. */
  enforced: boolean;
}

export interface PlanAndUsage {
  plan: TenantPlan;
  usage: {
    period: string;
    messagesSent: number;
    accounts: number;
    users: number;
    knowledgeDocuments: number;
  };
}

export interface UsagePeriod {
  period: string;
  messagesSent: number;
  updatedAt: string;
}

/** Un plan contratable del catálogo, con sus límites y su precio. */
export interface PlanTier {
  key: string;
  name: string;
  description: string;
  priceMonthly: number;
  monthlyMessageLimit?: number | null;
  maxAccounts?: number | null;
  maxUsers?: number | null;
  maxKnowledgeDocuments?: number | null;
}

export interface PlanCatalog {
  /** ISO 4217, p. ej. CRC. */
  currency: string;
  plans: PlanTier[];
}

/** Límites contratados. Un valor 0 o negativo quita el límite. */
export interface TenantPlanRequest {
  name?: string;
  monthlyMessageLimit?: number;
  maxAccounts?: number;
  maxUsers?: number;
  maxKnowledgeDocuments?: number;
  enforceMonthlyLimit?: boolean;
}

// ---- Facturación (cobro manual: transferencia o SINPE) ----

export type InvoiceStatus = 'pending' | 'underreview' | 'paid' | 'cancelled';

export interface Invoice {
  id: string;
  /** Correlativo legible; es lo que se cita en el detalle de la transferencia. */
  number: string;
  planKey: string;
  planName: string;
  amount: number;
  currency: string;
  /** Mes que cubre, yyyy-MM. */
  period: string;
  status: InvoiceStatus;
  issuedAt: string;
  dueAt: string;
  paymentMethod?: string | null;
  paymentReference?: string | null;
  receiptStorageKey?: string | null;
  reportedAt?: string | null;
  paidAt?: string | null;
  confirmedBy?: string | null;
  notes?: string | null;
}

/** Datos para pagar, tal como los configura el servidor. */
export interface BillingInfo {
  configured: boolean;
  businessName?: string | null;
  sinpeNumber?: string | null;
  bankName?: string | null;
  bankAccount?: string | null;
  taxId?: string | null;
  contactEmail?: string | null;
  currency: string;
  note: string;
}

/**
 * Datos fiscales del tenant como receptor, con la forma de la factura electrónica de Costa Rica
 * v4.4. Los códigos viajan como texto: "01" no es 1.
 */
export interface BillingProfile {
  nombre: string;
  /** 01 física · 02 jurídica · 03 DIMEX · 04 NITE. */
  tipoIdentificacion: string;
  /** Solo dígitos, sin guiones. */
  numeroIdentificacion: string;
  nombreComercial?: string | null;
  /** Código de actividad económica del receptor. */
  codigoActividad?: string | null;
  /** 1 dígito. */
  provincia?: string | null;
  /** 2 dígitos. */
  canton?: string | null;
  /** 2 dígitos. */
  distrito?: string | null;
  barrio?: string | null;
  otrasSenas?: string | null;
  telefonoCodigoPais?: string | null;
  telefonoNumero?: string | null;
  /** A dónde se envía el comprobante. */
  correoElectronico: string;
  updatedAt?: string;
}

export const TIPOS_IDENTIFICACION = [
  { v: '01', label: 'Cédula física', digitos: '9 dígitos' },
  { v: '02', label: 'Cédula jurídica', digitos: '10 dígitos' },
  { v: '03', label: 'DIMEX', digitos: '11 o 12 dígitos' },
  { v: '04', label: 'NITE', digitos: '10 dígitos' },
] as const;

export interface ReportPaymentRequest {
  method: 'sinpe' | 'transferencia' | 'otro';
  reference: string;
  receiptStorageKey?: string;
  notes?: string;
}

export interface AuditEntry {
  id: string;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  summary?: string | null;
  userId?: string | null;
  userEmail?: string | null;
  ipAddress?: string | null;
  timestamp: string;
}

export interface ImportContactsResult {
  created: number;
  updated: number;
  skipped: number;
}

export type QueueEntryStatusName = 'waiting' | 'assigned' | 'closed';

export interface QueueEntry {
  id: string;
  queueId: string;
  accountId: string;
  waId: string;
  status: QueueEntryStatusName;
  assignedUserId?: string | null;
  createdAt: string;
  assignedAt?: string | null;
  closedAt?: string | null;
}

/**
 * Cierre de una conversación desde la bandeja. El API no devuelve la entrada suelta: informa
 * además de si salió la encuesta de satisfacción, que depende de la configuración de la cola.
 */
export interface AgentCloseResult {
  entry: QueueEntry;
  csatSent: boolean;
}

/** Traspaso a otra cola, a otro agente o a ambos. Hay que indicar al menos uno. */
export interface TransferRequest {
  queueKey?: string;
  userId?: string;
  reason?: string;
}

/** Cola vista por un agente (subconjunto). */
export interface AgentQueue {
  id: string;
  key: string;
  name: string;
  autoAssign: boolean;
}

// ---- CRM de contactos ----

/** Envoltorio de paginación que usan los listados nuevos del API. */
export interface Paged<T> {
  items: T[];
  total: number;
  skip: number;
  take: number;
}

export interface ContactListItem {
  waId: string;
  /** Nombre efectivo: displayName ?? profileName. */
  name?: string | null;
  company?: string | null;
  email?: string | null;
  tags: string[];
  optedOut: boolean;
  /**
   * Bloqueado en WhatsApp: no puede escribir al negocio. Distinto del opt-out, que solo impide
   * escribirle a él.
   */
  blocked: boolean;
  windowOpen: boolean;
  lastInboundAt?: string | null;
  lastSeenAt: string;
}

/** Estado de la ventana de 24 h de un contacto. */
export interface ServiceWindow {
  waId: string;
  open: boolean;
  lastInboundAt?: string | null;
  expiresAt?: string | null;
}

export interface ContactActivity {
  totalMessages: number;
  inbound: number;
  outbound: number;
  firstMessageAt?: string | null;
  lastMessageAt?: string | null;
  lastMessagePreview?: string | null;
}

export interface ContactBotState {
  flowId?: string | null;
  flowName?: string | null;
  currentNodeKey?: string | null;
  status: string;
  variables: Record<string, string>;
  updatedAt: string;
}

export interface ContactQueueState {
  entryId: string;
  queueId: string;
  queueName: string;
  status: QueueEntryStatusName;
  assignedUserId?: string | null;
  assignedUserName?: string | null;
  createdAt: string;
}

/**
 * Ficha completa. Ojo: `activity`, `bot`, `queue` y `noteCount` solo vienen rellenos
 * en el GET de detalle; el PUT y los opt-in/out devuelven el mismo tipo con esa
 * parte vacía, así que no sirven para repintar la ficha entera.
 */
export interface ContactDetail extends ContactListItem {
  displayName?: string | null;
  profileName?: string | null;
  optedOutAt?: string | null;
  blockedAt?: string | null;
  windowExpiresAt?: string | null;
  firstSeenAt: string;
  activity: ContactActivity;
  bot?: ContactBotState | null;
  queue?: ContactQueueState | null;
  noteCount: number;
}

export interface UpdateContactRequest {
  displayName?: string | null;
  email?: string | null;
  company?: string | null;
  /** Reemplaza la lista completa (máx. 20). Se normalizan a minúsculas. */
  tags?: string[];
}

export interface ContactNote {
  id: string;
  text: string;
  authorUserId?: string | null;
  /** Null cuando la nota se creó con X-Api-Key en vez de sesión. */
  authorName?: string | null;
  createdAt: string;
}

export interface TagCount {
  tag: string;
  count: number;
}

/** Mensaje en la ficha del contacto: DTO propio, distinto del historial clásico. */
export interface ContactMessage {
  id: string;
  direction: 'inbound' | 'outbound';
  type: string;
  body?: string | null;
  status: string;
  createdAt: string;
  mediaMimeType?: string | null;
  mediaFilename?: string | null;
  mediaStorageKey?: string | null;
  replyToWaMessageId?: string | null;
  forwarded: boolean;
  errorMessage?: string | null;
}

// ---- WABA (passthrough de Graph API: snake_case, forma no garantizada) ----

export interface UpdateBusinessProfileRequest {
  about?: string;
  description?: string;
  address?: string;
  email?: string;
  vertical?: string;
  /** Máximo 2. */
  websites?: string[];
}

// ---- Alta guiada (Embedded Signup) ----

export interface EmbeddedSignupConfig {
  configured: boolean;
  appId?: string | null;
  configId?: string | null;
  graphVersion?: string | null;
}

/** Resultado del popup de Meta, ya canjeado por el servidor. */
export interface EmbeddedSignupResult {
  success: boolean;
  accountId?: string | null;
  wabaId?: string | null;
  phoneNumberId?: string | null;
  displayPhoneNumber?: string | null;
  verifiedName?: string | null;
  qualityRating?: string | null;
  /** True si el número quedó registrado y ya puede enviar. */
  registered: boolean;
  /** PIN de verificación en dos pasos recién fijado: hace falta para volver a registrar. */
  twoStepPin?: string | null;
  /** La cuenta se conectó pero algo quedó a medias. */
  warning?: string | null;
  error?: string | null;
}

export interface CompleteSignupRequest {
  /** Código de un solo uso del popup: caduca en segundos. */
  code: string;
  wabaId?: string;
  phoneNumberId?: string;
  displayName?: string;
}

// ---- Bitácora de errores (X-Admin-Key) ----

export interface LogEntry {
  id: string;
  timestamp: string;
  level: string;
  category: string;
  eventId: number;
  message: string;
  exceptionType?: string | null;
  traceId?: string | null;
  requestMethod?: string | null;
  requestPath?: string | null;
  tenantId?: string | null;
  userId?: string | null;
  /** Si es true, la traza completa se obtiene con el detalle. */
  hasException: boolean;
}

export interface LogEntryDetail extends LogEntry {
  exception?: string | null;
}

export interface LogSummary {
  since: string;
  total: number;
  byLevel: Record<string, number>;
  topCategories: { key: string; count: number }[];
  topExceptions: { key: string; count: number }[];
}

// ---- Bitácora de eventos de webhook (Meta) ----

export interface WebhookEventRow {
  id: string;
  field: string;
  accountId?: string | null;
  receivedAt: string;
  payload: string;
}

// ---- Diagnóstico de webhooks entrantes ----

/** Estado de un secreto guardado, sin revelarlo. `empty` = se guardó en blanco. */
export interface SecretState {
  state: 'ok' | 'empty' | 'missing';
  length: number;
}

export interface WebhookDiagnostics {
  /** URL que hay que pegar como Callback URL en Meta. */
  callbackUrl: string;
  appSecret: SecretState;
  verifyToken: SecretState;
  subscription: {
    ok: boolean;
    detail?: unknown;
    metaStatus: number;
  };
  events: {
    id: string;
    field: string;
    receivedAt: string;
    processedAt?: string | null;
    attempts: number;
    lastError?: string | null;
  }[];
  /** Entregas que llegaron y se rechazaron, con el motivo. No crean evento. */
  rejections: {
    timestamp: string;
    level: string;
    message: string;
  }[];
}

export const MESSAGE_STATUS_LABELS: Record<MessageStatus, string> = {
  0: 'Pendiente',
  1: 'Enviado',
  2: 'Entregado',
  3: 'Leído',
  4: 'Fallido',
  5: 'Recibido',
  /** Aceptado por el API y pendiente de que el worker lo entregue a Meta (`?async=true`). */
  6: 'Encolado',
};

export const MEDIA_TYPES = ['image', 'audio', 'video', 'document', 'sticker'] as const;

// ---- Análisis por IA de conversaciones ----

export type ChatSentiment = 'positive' | 'neutral' | 'negative' | 'mixed' | 'unknown';

/** Qué provocó el análisis. */
export type AnalysisTrigger = 'WindowClosed' | 'ConversationClosed' | 'Manual';

export interface ChatAnalysis {
  id: string;
  accountId: string;
  waId: string;
  queueEntryId?: string | null;
  trigger: AnalysisTrigger;
  /** `Failed` = el modelo no respondió o devolvió algo ininterpretable; mira `error`. */
  status: 'Ok' | 'Failed';
  periodStart: string;
  periodEnd: string;
  messageCount: number;
  summary: string;
  contactReason?: string | null;
  /** Temas separados por coma. */
  topics?: string | null;
  sentiment: ChatSentiment;
  satisfactionScore?: number | null;
  resolved?: boolean | null;
  serviceQualityScore?: number | null;
  improvementNote?: string | null;
  escalationRecommended: boolean;
  /** Objeto JSON serializado con los datos que el contacto dio en el diálogo. */
  detectedData?: string | null;
  model?: string | null;
  error?: string | null;
  createdAt: string;
}

/** El análisis manual puede no llegar a hacerse: no hay mensajes nuevos desde el anterior. */
export interface ChatAnalysisSkipped {
  skipped: string;
}

// ---- Encuestas ----

export type SurveyQuestionType = 'text' | 'number' | 'scale' | 'choice';

export interface SurveyQuestionDto {
  order: number;
  text: string;
  type: SurveyQuestionType;
  /** Solo en preguntas de elección. Hacen falta al menos dos. */
  choices: string[];
  scaleMin?: number | null;
  scaleMax?: number | null;
  required: boolean;
  /** Clave con la que guardar la respuesta en la ficha del contacto. */
  saveAsAttribute?: string | null;
}

export interface Survey {
  id: string;
  name: string;
  description?: string | null;
  introMessage?: string | null;
  thanksMessage?: string | null;
  isActive: boolean;
  questions: SurveyQuestionDto[];
  sentCount: number;
  completedCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface SurveyRequest {
  name: string;
  description?: string | null;
  introMessage?: string | null;
  thanksMessage?: string | null;
  isActive: boolean;
  /** Lista completa: reemplaza las preguntas anteriores. */
  questions: SurveyQuestionDto[];
}

export type SurveyResponseStatus = 'InProgress' | 'Completed' | 'Abandoned';

export interface SurveyResponseRow {
  id: string;
  waId: string;
  status: SurveyResponseStatus;
  currentQuestionOrder: number;
  startedAt: string;
  completedAt?: string | null;
  answers: { questionOrder: number; value: string }[];
}

/** Resultados agregados por pregunta. */
export interface SurveyResults {
  surveyId: string;
  name: string;
  sent: number;
  completed: number;
  inProgress: number;
  abandoned: number;
  completionRate?: number | null;
  questions: {
    order: number;
    text: string;
    type: SurveyQuestionType;
    answered: number;
    /** Solo en numéricas y escalas. */
    summary?: { count: number; average: number; min: number; max: number } | null;
    /** Solo en elección y escala. */
    distribution?: { value: string; count: number }[] | null;
    /** Solo en texto libre: últimas respuestas, sin agregar. */
    samples?: string[] | null;
  }[];
}

// ---- Mapa de calor de carga por cola ----

export interface QueueHeatCell {
  /** yyyy-MM-dd, en UTC. */
  date: string;
  total: number;
  breached: number;
  unanswered: number;
  /** Mediana de segundos hasta la primera respuesta ese día, o null si no hubo ninguna. */
  firstResponseSeconds?: number | null;
}

export interface QueueHeatRow {
  queueId: string;
  key: string;
  name: string;
  /** Sin plazo, esa fila nunca marca incumplimientos. */
  slaFirstResponseMinutes?: number | null;
  cells: QueueHeatCell[];
}

export interface QueueHeatmap {
  desde: string;
  days: number;
  dates: string[];
  rows: QueueHeatRow[];
}

/** Agregados de los análisis del periodo. Es lo que se mira para revisar, no uno a uno. */
export interface ChatAnalysisSummary {
  desde: string;
  days: number;
  total: number;
  /** Análisis que el modelo no pudo completar. Si crece, algo va mal con la IA. */
  failed: number;
  bySentiment: { sentiment: ChatSentiment; count: number }[];
  byReason: { reason: string; count: number }[];
  byTopic: { topic: string; count: number }[];
  /** Porcentaje de las que se pudo determinar y quedaron resueltas. */
  resolvedRate?: number | null;
  averageSatisfaction?: number | null;
  averageServiceQuality?: number | null;
  /** Conversaciones que debieron pasar a una persona y no pasaron. */
  escalationRecommended: number;
  byTrigger: { trigger: AnalysisTrigger; count: number }[];
}
