import type { ApiClient } from './client';
import type {
  Account,
  AgentCloseResult,
  AgentMetrics,
  AgentQueue,
  AiFunction,
  AiFunctionRequest,
  ApiKeyCreated,
  ApiKeyView,
  AuditEntry,
  BillingInfo,
  BillingProfile,
  BillingUsage,
  ChatAnalysis,
  ChatAnalysisSkipped,
  ChatAnalysisSummary,
  ContactTask,
  ContactTaskRequest,
  QueueHeatmap,
  Survey,
  SurveyRequest,
  SurveyResponseRow,
  SurveyResults,
  Invoice,
  ReportPaymentRequest,
  Campaign,
  CampaignPreview,
  CampaignPreviewRequest,
  CampaignRecipient,
  CampaignRecipientStatus,
  CompleteSignupRequest,
  CreateAccountRequest,
  CreateCampaignRequest,
  ContactDetail,
  ContactListItem,
  ContactMessage,
  ContactNote,
  CreateQueueRequest,
  CreateSubscriptionRequest,
  CreateUserRequest,
  EmbeddedSignupConfig,
  EmbeddedSignupResult,
  FlowResponse,
  ImportContactsResult,
  KnowledgeDocument,
  KnowledgeDocumentRequest,
  KnowledgeSearchHit,
  Paged,
  PlanAndUsage,
  PlanCatalog,
  LoginRequest,
  LoginResponse,
  Message,
  MessageSearchHit,
  MessageSearchParams,
  MessageStatusView,
  QuickReply,
  QuickReplyRequest,
  RegisterRequest,
  RegisterResponse,
  Segment,
  SegmentPreview,
  SegmentRequest,
  SandboxInboundRequest,
  SandboxStatus,
  Queue,
  QueueEntry,
  Role,
  SendContactsRequest,
  SendFlowRequest,
  SendLocationRequest,
  SendMediaFromStorageRequest,
  SendMediaLinkRequest,
  SendMessageResult,
  SendOptions,
  SendProductRequest,
  SendReactionRequest,
  SendTemplateRequest,
  SendTextRequest,
  ServiceWindow,
  SessionResponse,
  SlaBreach,
  StatisticsSummary,
  SubscriptionResponse,
  TagCount,
  TeamMetrics,
  TransferRequest,
  UpdateBusinessProfileRequest,
  UpdateContactRequest,
  UpdateQueueRequest,
  UpdateRoleRequest,
  UsagePeriod,
  User,
  WebhookDiagnostics,
  WebhookEventRow,
} from './types';

/**
 * Traduce las opciones de entrega a query string. `scheduleAt` ya implica encolar en el
 * backend, así que no hace falta mandar los dos.
 */
function sendQuery(opts?: SendOptions) {
  if (!opts) return undefined;
  if (opts.scheduleAt) return { scheduleAt: opts.scheduleAt };
  return opts.async ? { async: true } : undefined;
}

/** Funciones tipadas por área funcional. Reciben el ApiClient del contexto. */
export function makeEndpoints(api: ApiClient) {
  return {
    // ---- Auth (JWT) ----
    login: (body: LoginRequest) =>
      api.request<LoginResponse>('/api/auth/login', { method: 'POST', body }),
    register: (body: RegisterRequest) =>
      api.request<RegisterResponse>('/api/auth/register', { method: 'POST', body }),
    /**
     * Revoca la cadena del token de refresco. El panel lo llama al cerrar sesión para que el
     * token deje de valer en el servidor, no solo de estar guardado aquí.
     */
    logout: (refreshToken: string) =>
      api.request<void>('/api/auth/logout', { method: 'POST', body: { refreshToken } }),
    me: () =>
      api.request<{ userId: string; email: string; tenantId: string; role: string }>(
        '/api/auth/me',
        { auth: 'bearer' },
      ),

    /**
     * Configuración pública del backend. Sirve para saber en qué dirección vive la API de cara
     * a fuera, que es la que hay que darle a Meta como Callback URL. Anónimo y sin secretos.
     */
    publicConfig: () => api.request<{ publicBaseUrl: string }>('/api/config'),

    // ---- Autoservicio del tenant (JWT): gestión del propio tenant sin clave admin ----
    myAccounts: () => api.request<Account[]>('/api/me/accounts', { auth: 'bearer' }),
    createMyAccount: (body: CreateAccountRequest) =>
      api.request<Account>('/api/me/accounts', { method: 'POST', auth: 'bearer', body }),
    deleteMyAccount: (id: string) =>
      api.request<void>(`/api/me/accounts/${id}`, { method: 'DELETE', auth: 'bearer' }),
    /**
     * Crea (o devuelve, si ya existe) la cuenta de pruebas de la organización. No consume cupo
     * del plan y no puede enviar nada a Meta.
     */
    createSandboxAccount: () =>
      api.request<Account>('/api/me/accounts/sandbox', { method: 'POST', auth: 'bearer' }),

    // ---- Sandbox: simular lo que en producción manda Meta ----
    /** Inyecta un mensaje entrante: crea el contacto, abre la ventana y dispara el flujo. */
    sandboxInbound: (accountId: string, body: SandboxInboundRequest) =>
      api.request<{ waMessageId: string; from: string; type: string }>(
        `/api/accounts/${accountId}/sandbox/inbound`,
        { method: 'POST', auth: 'tenant', body },
      ),
    /** Simula el acuse de un envío: sin esto, en sandbox todo se queda en «enviado». */
    sandboxStatus: (accountId: string, messageId: string, status: SandboxStatus) =>
      api.request<{ messageId: string; status: string }>(
        `/api/accounts/${accountId}/sandbox/status`,
        { method: 'POST', auth: 'tenant', body: { messageId, status } },
      ),
    myUsers: () => api.request<User[]>('/api/me/users', { auth: 'bearer' }),
    myCreateUser: (body: CreateUserRequest) =>
      api.request<User>('/api/me/users', { method: 'POST', auth: 'bearer', body }),
    myRoles: () => api.request<Role[]>('/api/me/roles', { auth: 'bearer' }),
    myCreateRole: (name: string, description?: string, permissions?: string[]) =>
      api.request<Role>('/api/me/roles', {
        method: 'POST',
        auth: 'bearer',
        body: { name, description, permissions },
      }),
    /** `permissions` reemplaza la lista completa; lo que no se envía se deja como está. */
    myUpdateRole: (id: string, body: UpdateRoleRequest) =>
      api.request<Role>(`/api/me/roles/${id}`, { method: 'PUT', auth: 'bearer', body }),
    myApiKeys: () => api.request<ApiKeyView[]>('/api/me/apikeys', { auth: 'bearer' }),
    myCreateApiKey: (name: string) =>
      api.request<ApiKeyCreated>('/api/me/apikeys', { method: 'POST', auth: 'bearer', body: { name } }),
    myRevokeApiKey: (keyId: string) =>
      api.request<void>(`/api/me/apikeys/${keyId}`, { method: 'DELETE', auth: 'bearer' }),
    myUpdateAi: (openAiApiKey: string | null) =>
      api.request<{ id: string; openAiConfigured: boolean }>('/api/me/ai', {
        method: 'PUT',
        auth: 'bearer',
        body: { openAiApiKey },
      }),

    // ---- Tenant: estadísticas ----
    stats: (days = 7) =>
      api.request<StatisticsSummary>('/api/statistics', { auth: 'tenant', query: { days } }),
    statsForAccount: (accountId: string, days = 7) =>
      api.request<StatisticsSummary>(`/api/statistics/accounts/${accountId}`, {
        auth: 'tenant',
        query: { days },
      }),

    // ---- Tenant: mensajes ----
    listMessages: (accountId: string, take = 50) =>
      api.request<Message[]>(`/api/accounts/${accountId}/messages`, {
        auth: 'tenant',
        query: { take },
      }),
    /** Con `opts` el envío se encola (202) o se programa; sin ellos espera a Meta como siempre. */
    sendText: (accountId: string, body: SendTextRequest, opts?: SendOptions) =>
      api.request<SendMessageResult>(`/api/accounts/${accountId}/messages/text`, {
        method: 'POST',
        auth: 'tenant',
        body,
        query: sendQuery(opts),
      }),
    sendTemplate: (accountId: string, body: SendTemplateRequest, opts?: SendOptions) =>
      api.request<SendMessageResult>(`/api/accounts/${accountId}/messages/template`, {
        method: 'POST',
        auth: 'tenant',
        body,
        query: sendQuery(opts),
      }),
    sendMediaLink: (accountId: string, body: SendMediaLinkRequest, opts?: SendOptions) =>
      api.request<SendMessageResult>(`/api/accounts/${accountId}/messages/media`, {
        method: 'POST',
        auth: 'tenant',
        body,
        query: sendQuery(opts),
      }),
    sendMediaUpload: (accountId: string, form: FormData) =>
      api.request<SendMessageResult>(`/api/accounts/${accountId}/messages/media/upload`, {
        method: 'POST',
        auth: 'tenant',
        formData: form,
      }),
    sendMediaFromStorage: (
      accountId: string,
      body: SendMediaFromStorageRequest,
      opts?: SendOptions,
    ) =>
      api.request<SendMessageResult>(`/api/accounts/${accountId}/messages/media/from-storage`, {
        method: 'POST',
        auth: 'tenant',
        body,
        query: sendQuery(opts),
      }),
    sendLocation: (accountId: string, body: SendLocationRequest, opts?: SendOptions) =>
      api.request<SendMessageResult>(`/api/accounts/${accountId}/messages/location`, {
        method: 'POST',
        auth: 'tenant',
        body,
        query: sendQuery(opts),
      }),
    /** Emoji vacío retira la reacción anterior. */
    sendReaction: (accountId: string, body: SendReactionRequest) =>
      api.request<SendMessageResult>(`/api/accounts/${accountId}/messages/reaction`, {
        method: 'POST',
        auth: 'tenant',
        body,
      }),
    sendContacts: (accountId: string, body: SendContactsRequest, opts?: SendOptions) =>
      api.request<SendMessageResult>(`/api/accounts/${accountId}/messages/contacts`, {
        method: 'POST',
        auth: 'tenant',
        body,
        query: sendQuery(opts),
      }),
    sendFlow: (accountId: string, body: SendFlowRequest, opts?: SendOptions) =>
      api.request<SendMessageResult>(`/api/accounts/${accountId}/messages/flow`, {
        method: 'POST',
        auth: 'tenant',
        body,
        query: sendQuery(opts),
      }),
    sendProduct: (accountId: string, body: SendProductRequest, opts?: SendOptions) =>
      api.request<SendMessageResult>(`/api/accounts/${accountId}/messages/product`, {
        method: 'POST',
        auth: 'tenant',
        body,
        query: sendQuery(opts),
      }),
    /** Marca como leído y muestra el indicador de "escribiendo…" al contacto. */
    markRead: (accountId: string, waMessageId: string) =>
      api.request<unknown>(`/api/accounts/${accountId}/messages/${waMessageId}/read`, {
        method: 'POST',
        auth: 'tenant',
      }),
    searchMessages: (accountId: string, params: MessageSearchParams = {}) =>
      api.request<Paged<MessageSearchHit>>(`/api/accounts/${accountId}/messages/search`, {
        auth: 'tenant',
        query: { take: 50, ...params },
      }),
    /** Estado de un envío. Es la contraparte de los envíos encolados (`?async=true`). */
    messageStatus: (accountId: string, messageId: string) =>
      api.request<MessageStatusView>(`/api/accounts/${accountId}/messages/${messageId}/status`, {
        auth: 'tenant',
      }),

    // ---- Tenant: plantillas en Meta (respuestas crudas de Graph API) ----
    listTemplates: (accountId: string, limit = 100) =>
      api.request<Record<string, unknown>>(`/api/accounts/${accountId}/templates`, {
        auth: 'tenant',
        query: { limit },
      }),
    createTemplate: (accountId: string, body: unknown) =>
      api.request<Record<string, unknown>>(`/api/accounts/${accountId}/templates`, {
        method: 'POST',
        auth: 'tenant',
        body,
      }),
    deleteTemplate: (accountId: string, name: string) =>
      api.request<Record<string, unknown>>(`/api/accounts/${accountId}/templates/${name}`, {
        method: 'DELETE',
        auth: 'tenant',
      }),

    // ---- Tenant: flows ----
    listFlows: (accountId: string) =>
      api.request<FlowResponse[]>(`/api/accounts/${accountId}/flows`, { auth: 'tenant' }),
    setFlowEnabled: (accountId: string, flowId: string, enabled: boolean) =>
      api.request<{ id: string; isEnabled: boolean }>(
        `/api/accounts/${accountId}/flows/${flowId}/${enabled ? 'enable' : 'disable'}`,
        { method: 'POST', auth: 'tenant' },
      ),
    deleteFlow: (accountId: string, flowId: string) =>
      api.request<void>(`/api/accounts/${accountId}/flows/${flowId}`, {
        method: 'DELETE',
        auth: 'tenant',
      }),
    createFlow: (accountId: string, body: unknown) =>
      api.request<FlowResponse>(`/api/accounts/${accountId}/flows`, {
        method: 'POST',
        auth: 'tenant',
        body,
      }),
    updateFlow: (accountId: string, flowId: string, body: unknown) =>
      api.request<FlowResponse>(`/api/accounts/${accountId}/flows/${flowId}`, {
        method: 'PUT',
        auth: 'tenant',
        body,
      }),

    // ---- Tenant: sesiones ----
    listSessions: (accountId: string, status?: string) =>
      api.request<SessionResponse[]>(`/api/accounts/${accountId}/sessions`, {
        auth: 'tenant',
        query: { status },
      }),
    closeSession: (accountId: string, waId: string) =>
      api.request<SessionResponse>(`/api/accounts/${accountId}/sessions/${waId}/close`, {
        method: 'POST',
        auth: 'tenant',
      }),
    /** Estado del bot para un contacto. Devuelve "closed" si nunca entró al flujo. */
    getSession: (accountId: string, waId: string) =>
      api.request<SessionResponse>(`/api/accounts/${accountId}/sessions/${waId}`, { auth: 'tenant' }),
    /** El agente toma la conversación: el bot deja de responder a ese contacto. */
    takeoverSession: (accountId: string, waId: string) =>
      api.request<SessionResponse>(`/api/accounts/${accountId}/sessions/${waId}/takeover`, {
        method: 'POST',
        auth: 'tenant',
      }),
    /** Devuelve la conversación al bot. */
    releaseSession: (accountId: string, waId: string) =>
      api.request<SessionResponse>(`/api/accounts/${accountId}/sessions/${waId}/release`, {
        method: 'POST',
        auth: 'tenant',
      }),

    // ---- Tenant: webhooks salientes ----
    listSubscriptions: () =>
      api.request<SubscriptionResponse[]>('/api/webhook-subscriptions', { auth: 'tenant' }),
    createSubscription: (body: CreateSubscriptionRequest) =>
      api.request<SubscriptionResponse>('/api/webhook-subscriptions', {
        method: 'POST',
        auth: 'tenant',
        body,
      }),
    deleteSubscription: (id: string) =>
      api.request<void>(`/api/webhook-subscriptions/${id}`, { method: 'DELETE', auth: 'tenant' }),

    // ---- Tenant: colas de atención ----
    listQueues: () => api.request<Queue[]>('/api/queues', { auth: 'tenant' }),
    getQueue: (id: string) => api.request<Queue>(`/api/queues/${id}`, { auth: 'tenant' }),
    createQueue: (body: CreateQueueRequest) =>
      api.request<Queue>('/api/queues', { method: 'POST', auth: 'tenant', body }),
    updateQueue: (id: string, body: UpdateQueueRequest) =>
      api.request<Queue>(`/api/queues/${id}`, { method: 'PUT', auth: 'tenant', body }),
    /** Con `force` cierra las conversaciones abiertas; sin él, el API responde 409. */
    deleteQueue: (id: string, force = false) =>
      api.request<void>(`/api/queues/${id}`, {
        method: 'DELETE',
        auth: 'tenant',
        query: force ? { force: true } : undefined,
      }),
    addQueueMember: (queueId: string, userId: string) =>
      api.request<void>(`/api/queues/${queueId}/members`, {
        method: 'POST',
        auth: 'tenant',
        body: { userId },
      }),
    removeQueueMember: (queueId: string, userId: string) =>
      api.request<void>(`/api/queues/${queueId}/members/${userId}`, {
        method: 'DELETE',
        auth: 'tenant',
      }),
    queueEntries: (queueId: string, status?: string) =>
      api.request<QueueEntry[]>(`/api/queues/${queueId}/entries`, {
        auth: 'tenant',
        query: { status },
      }),

    // ---- Agente (JWT): bandeja de conversaciones ----
    agentQueues: () => api.request<AgentQueue[]>('/api/agent/queues', { auth: 'bearer' }),
    agentEntries: (status?: string) =>
      api.request<QueueEntry[]>('/api/agent/entries', { auth: 'bearer', query: { status } }),
    agentClaim: (id: string) =>
      api.request<QueueEntry>(`/api/agent/entries/${id}/claim`, { method: 'POST', auth: 'bearer' }),
    agentAssign: (id: string, userId: string) =>
      api.request<QueueEntry>(`/api/agent/entries/${id}/assign`, {
        method: 'POST',
        auth: 'bearer',
        body: { userId },
      }),
    agentClose: (id: string) =>
      api.request<AgentCloseResult>(`/api/agent/entries/${id}/close`, {
        method: 'POST',
        auth: 'bearer',
      }),
    /** Traspasa a otra cola, a otro agente o a ambos; hace falta al menos uno de los dos. */
    agentTransfer: (id: string, body: TransferRequest) =>
      api.request<QueueEntry>(`/api/agent/entries/${id}/transfer`, {
        method: 'POST',
        auth: 'bearer',
        body,
      }),
    agentReply: (id: string, text: string) =>
      api.request<SendMessageResult>(`/api/agent/entries/${id}/reply`, {
        method: 'POST',
        auth: 'bearer',
        body: { text },
      }),

    // ---- Tenant: CRM de contactos ----
    listContacts: (
      accountId: string,
      params: { search?: string; tag?: string; optedOut?: boolean; windowOpen?: boolean; skip?: number; take?: number } = {},
    ) =>
      api.request<Paged<ContactListItem>>(`/api/accounts/${accountId}/contacts`, {
        auth: 'tenant',
        query: { take: 50, ...params },
      }),
    contactTags: (accountId: string) =>
      api.request<TagCount[]>(`/api/accounts/${accountId}/contacts/tags`, { auth: 'tenant' }),
    getContact: (accountId: string, waId: string) =>
      api.request<ContactDetail>(`/api/accounts/${accountId}/contacts/${waId}`, { auth: 'tenant' }),
    updateContact: (accountId: string, waId: string, body: UpdateContactRequest) =>
      api.request<ContactDetail>(`/api/accounts/${accountId}/contacts/${waId}`, {
        method: 'PUT',
        auth: 'tenant',
        body,
      }),
    contactMessages: (accountId: string, waId: string, take = 50, skip = 0) =>
      api.request<Paged<ContactMessage>>(`/api/accounts/${accountId}/contacts/${waId}/messages`, {
        auth: 'tenant',
        query: { take, skip },
      }),
    contactNotes: (accountId: string, waId: string) =>
      api.request<ContactNote[]>(`/api/accounts/${accountId}/contacts/${waId}/notes`, {
        auth: 'tenant',
      }),
    addContactNote: (accountId: string, waId: string, text: string) =>
      api.request<ContactNote>(`/api/accounts/${accountId}/contacts/${waId}/notes`, {
        method: 'POST',
        auth: 'tenant',
        body: { text },
      }),
    deleteContactNote: (accountId: string, waId: string, noteId: string) =>
      api.request<void>(`/api/accounts/${accountId}/contacts/${waId}/notes/${noteId}`, {
        method: 'DELETE',
        auth: 'tenant',
      }),
    setContactOptOut: (accountId: string, waId: string, optedOut: boolean) =>
      api.request<ContactDetail>(
        `/api/accounts/${accountId}/contacts/${waId}/${optedOut ? 'opt-out' : 'opt-in'}`,
        { method: 'POST', auth: 'tenant' },
      ),
    /**
     * Bloquea o desbloquea en WhatsApp. Bloquear implica opt-out; desbloquear no lo revierte,
     * eso es una decisión aparte.
     */
    setContactBlocked: (accountId: string, waId: string, blocked: boolean) =>
      api.request<ContactDetail>(
        `/api/accounts/${accountId}/contacts/${waId}/${blocked ? 'block' : 'unblock'}`,
        { method: 'POST', auth: 'tenant' },
      ),
    /** Números bloqueados según Meta (respuesta cruda de Graph API, paginada por cursor). */
    listBlockedNumbers: (accountId: string, limit = 100, after?: string) =>
      api.request<Record<string, unknown>>(`/api/accounts/${accountId}/contacts/blocked`, {
        auth: 'tenant',
        query: { limit, after },
      }),
    contactWindow: (accountId: string, waId: string) =>
      api.request<ServiceWindow>(`/api/accounts/${accountId}/contacts/${waId}/window`, {
        auth: 'tenant',
      }),

    // ---- Tenant: campañas ----
    /** Alcance del segmento antes de programar. Después el alcance queda fijado. */
    previewCampaign: (body: CampaignPreviewRequest) =>
      api.request<CampaignPreview>('/api/campaigns/preview', {
        method: 'POST',
        auth: 'tenant',
        body,
      }),
    listCampaigns: (accountId?: string) =>
      api.request<Campaign[]>('/api/campaigns', { auth: 'tenant', query: { accountId } }),
    getCampaign: (id: string) => api.request<Campaign>(`/api/campaigns/${id}`, { auth: 'tenant' }),
    createCampaign: (body: CreateCampaignRequest) =>
      api.request<Campaign>('/api/campaigns', { method: 'POST', auth: 'tenant', body }),
    campaignRecipients: (
      id: string,
      params: { status?: CampaignRecipientStatus; skip?: number; take?: number } = {},
    ) =>
      api.request<Paged<CampaignRecipient>>(`/api/campaigns/${id}/recipients`, {
        auth: 'tenant',
        query: { take: 100, ...params },
      }),
    /** Fija los destinatarios y programa. Sin `scheduledAt` sale en cuanto el worker la vea. */
    scheduleCampaign: (id: string, scheduledAt?: string) =>
      api.request<Campaign>(`/api/campaigns/${id}/schedule`, {
        method: 'POST',
        auth: 'tenant',
        body: { scheduledAt: scheduledAt ?? null },
      }),
    pauseCampaign: (id: string) =>
      api.request<Campaign>(`/api/campaigns/${id}/pause`, { method: 'POST', auth: 'tenant' }),
    resumeCampaign: (id: string) =>
      api.request<Campaign>(`/api/campaigns/${id}/resume`, { method: 'POST', auth: 'tenant' }),
    cancelCampaign: (id: string) =>
      api.request<Campaign>(`/api/campaigns/${id}/cancel`, { method: 'POST', auth: 'tenant' }),
    deleteCampaign: (id: string) =>
      api.request<void>(`/api/campaigns/${id}`, { method: 'DELETE', auth: 'tenant' }),

    // ---- Tenant: segmentos de contactos ----
    listSegments: (accountId?: string) =>
      api.request<Segment[]>('/api/segments', { auth: 'tenant', query: { accountId } }),
    getSegment: (id: string) => api.request<Segment>(`/api/segments/${id}`, { auth: 'tenant' }),
    createSegment: (body: SegmentRequest) =>
      api.request<Segment>('/api/segments', { method: 'POST', auth: 'tenant', body }),
    updateSegment: (id: string, body: SegmentRequest) =>
      api.request<Segment>(`/api/segments/${id}`, { method: 'PUT', auth: 'tenant', body }),
    deleteSegment: (id: string) =>
      api.request<void>(`/api/segments/${id}`, { method: 'DELETE', auth: 'tenant' }),
    /** Alcance del segmento guardado: la misma consulta que usará la campaña. */
    segmentPreview: (id: string) =>
      api.request<SegmentPreview>(`/api/segments/${id}/preview`, { auth: 'tenant' }),
    /** Alcance de unos criterios sueltos, para verlo mientras se define el segmento. */
    segmentPreviewDraft: (body: SegmentRequest) =>
      api.request<SegmentPreview>('/api/segments/preview', { method: 'POST', auth: 'tenant', body }),

    // ---- Tenant: IA (base de conocimiento) ----
    listKnowledge: () => api.request<KnowledgeDocument[]>('/api/knowledge', { auth: 'tenant' }),
    getKnowledge: (id: string) =>
      api.request<KnowledgeDocument>(`/api/knowledge/${id}`, { auth: 'tenant' }),
    /** Devuelve `indexed: false` si el documento se guardó pero no se pudo indexar. */
    createKnowledge: (body: KnowledgeDocumentRequest) =>
      api.request<{ document: KnowledgeDocument; indexed: boolean }>('/api/knowledge', {
        method: 'POST',
        auth: 'tenant',
        body,
      }),
    /** Solo reindexa si cambia el contenido: recalcular vectores cuesta dinero. */
    updateKnowledge: (id: string, body: KnowledgeDocumentRequest) =>
      api.request<{ document: KnowledgeDocument; reindexed: boolean }>(`/api/knowledge/${id}`, {
        method: 'PUT',
        auth: 'tenant',
        body,
      }),
    reindexKnowledge: (id: string) =>
      api.request<KnowledgeDocument>(`/api/knowledge/${id}/reindex`, {
        method: 'POST',
        auth: 'tenant',
      }),
    deleteKnowledge: (id: string) =>
      api.request<void>(`/api/knowledge/${id}`, { method: 'DELETE', auth: 'tenant' }),
    /** Prueba qué encontraría el bot, sin escribirle por WhatsApp. */
    searchKnowledge: (q: string, take = 4) =>
      api.request<KnowledgeSearchHit[]>('/api/knowledge/search', {
        auth: 'tenant',
        query: { q, take },
      }),

    // ---- Tenant: IA (funciones del bot) ----
    listAiFunctions: () => api.request<AiFunction[]>('/api/ai-functions', { auth: 'tenant' }),
    createAiFunction: (body: AiFunctionRequest) =>
      api.request<AiFunction>('/api/ai-functions', { method: 'POST', auth: 'tenant', body }),
    updateAiFunction: (id: string, body: AiFunctionRequest) =>
      api.request<AiFunction>(`/api/ai-functions/${id}`, { method: 'PUT', auth: 'tenant', body }),
    deleteAiFunction: (id: string) =>
      api.request<void>(`/api/ai-functions/${id}`, { method: 'DELETE', auth: 'tenant' }),
    /** Ejecuta la función y devuelve lo que recibiría el modelo. */
    testAiFunction: (id: string, args: Record<string, unknown>) =>
      api.request<{ function: string; result: string }>(`/api/ai-functions/${id}/test`, {
        method: 'POST',
        auth: 'tenant',
        body: args,
      }),

    // ---- Tenant: respuestas rápidas ----
    listQuickReplies: (params: { category?: string; search?: string } = {}) =>
      api.request<QuickReply[]>('/api/quick-replies', { auth: 'tenant', query: params }),
    createQuickReply: (body: QuickReplyRequest) =>
      api.request<QuickReply>('/api/quick-replies', { method: 'POST', auth: 'tenant', body }),
    updateQuickReply: (id: string, body: QuickReplyRequest) =>
      api.request<QuickReply>(`/api/quick-replies/${id}`, { method: 'PUT', auth: 'tenant', body }),
    deleteQuickReply: (id: string) =>
      api.request<void>(`/api/quick-replies/${id}`, { method: 'DELETE', auth: 'tenant' }),
    /** Texto con las variables del contacto ya sustituidas. Cuenta el uso. */
    renderQuickReply: (id: string, accountId: string, waId: string) =>
      api.request<{ id: string; shortcut: string; text: string }>(
        `/api/quick-replies/${id}/render`,
        { auth: 'tenant', query: { accountId, waId } },
      ),

    // ---- Tenant: métricas del equipo y facturación ----
    teamMetrics: (days = 7, queueId?: string) =>
      api.request<TeamMetrics>('/api/team/metrics', { auth: 'tenant', query: { days, queueId } }),
    teamMetricsByAgent: (days = 7, queueId?: string) =>
      api.request<{ desde: string; days: number; agents: AgentMetrics[] }>(
        '/api/team/metrics/agents',
        { auth: 'tenant', query: { days, queueId } },
      ),
    /** Carga por cola y día para el mapa de calor. Trae las tres medidas de cada celda. */
    queueHeatmap: (days = 14) =>
      api.request<QueueHeatmap>('/api/team/metrics/heatmap', { auth: 'tenant', query: { days } }),
    slaBreaches: (take = 50) =>
      api.request<SlaBreach[]>('/api/team/metrics/sla-breaches', { auth: 'tenant', query: { take } }),
    billingUsage: (days = 30, accountId?: string) =>
      api.request<BillingUsage>('/api/billing/usage', { auth: 'tenant', query: { days, accountId } }),

    // ---- Tenant: tareas del contacto ----
    contactTasks: (accountId: string, waId: string, includeClosed = true) =>
      api.request<ContactTask[]>(`/api/accounts/${accountId}/contacts/${waId}/tasks`, {
        auth: 'tenant',
        query: { includeClosed },
      }),
    createContactTask: (accountId: string, waId: string, body: ContactTaskRequest) =>
      api.request<ContactTask>(`/api/accounts/${accountId}/contacts/${waId}/tasks`, {
        method: 'POST',
        auth: 'tenant',
        body,
      }),
    /** Lo que no se envía se deja como está. */
    updateTask: (id: string, body: ContactTaskRequest) =>
      api.request<ContactTask>(`/api/tasks/${id}`, { method: 'PUT', auth: 'tenant', body }),
    deleteTask: (id: string) =>
      api.request<void>(`/api/tasks/${id}`, { method: 'DELETE', auth: 'tenant' }),
    /** Tareas de toda la organización, para ver qué tiene pendiente el equipo. */
    listTasks: (params: { status?: string; assignedUserId?: string; overdue?: boolean; skip?: number; take?: number } = {}) =>
      api.request<{ total: number; skip: number; take: number; items: ContactTask[] }>('/api/tasks', {
        auth: 'tenant',
        query: params,
      }),

    // ---- Tenant: encuestas ----
    listSurveys: () => api.request<Survey[]>('/api/surveys', { auth: 'tenant' }),
    getSurvey: (id: string) => api.request<Survey>(`/api/surveys/${id}`, { auth: 'tenant' }),
    createSurvey: (body: SurveyRequest) =>
      api.request<Survey>('/api/surveys', { method: 'POST', auth: 'tenant', body }),
    /**
     * Reemplaza la definición. Si la encuesta ya tiene respuestas, las preguntas NO se tocan y
     * la respuesta lo indica en `questionsLocked`: cambiarlas dejaría huérfano lo ya contestado.
     */
    updateSurvey: (id: string, body: SurveyRequest) =>
      api.request<{ survey: Survey; questionsLocked: boolean; note?: string | null }>(
        `/api/surveys/${id}`,
        { method: 'PUT', auth: 'tenant', body },
      ),
    deleteSurvey: (id: string) =>
      api.request<void>(`/api/surveys/${id}`, { method: 'DELETE', auth: 'tenant' }),
    sendSurvey: (id: string, accountId: string, waId: string) =>
      api.request<{ responseId: string; waId: string; startedAt: string }>(
        `/api/surveys/${id}/send`,
        { method: 'POST', auth: 'tenant', body: { accountId, waId } },
      ),
    surveyResponses: (id: string, skip = 0, take = 50) =>
      api.request<{ total: number; skip: number; take: number; items: SurveyResponseRow[] }>(
        `/api/surveys/${id}/responses`,
        { auth: 'tenant', query: { skip, take } },
      ),
    surveyResults: (id: string) =>
      api.request<SurveyResults>(`/api/surveys/${id}/results`, { auth: 'tenant' }),

    // ---- Tenant: análisis por IA de conversaciones ----
    /** Agregados de los análisis del periodo, para el panel y la revisión. */
    analysisSummary: (days = 30, accountId?: string) =>
      api.request<ChatAnalysisSummary>('/api/analysis/summary', {
        auth: 'tenant',
        query: { days, accountId },
      }),
    /** Análisis guardados de un contacto, del más reciente al más antiguo. */
    contactAnalysis: (accountId: string, waId: string) =>
      api.request<ChatAnalysis[]>(`/api/accounts/${accountId}/contacts/${waId}/analysis`, {
        auth: 'tenant',
      }),
    /**
     * Analiza ahora la conversación. Devuelve `{ skipped }` en vez de un análisis cuando no hay
     * mensajes nuevos desde el anterior: no es un error, es que no había nada que leer.
     */
    analyzeContact: (accountId: string, waId: string) =>
      api.request<ChatAnalysis | ChatAnalysisSkipped>(
        `/api/accounts/${accountId}/contacts/${waId}/analysis`,
        { method: 'POST', auth: 'tenant' },
      ),

    // ---- Tenant: plan, consumo y auditoría ----
    plan: () => api.request<PlanAndUsage>('/api/platform/plan', { auth: 'tenant' }),
    /** Planes contratables con sus límites y precio: los sirve el API para que no se dupliquen. */
    planCatalog: () => api.request<PlanCatalog>('/api/platform/plans', { auth: 'tenant' }),
    /** Contrata un plan del catálogo. Aplica sus límites al momento. */
    changePlan: (plan: string) =>
      api.request<{ plan: string; name: string }>('/api/me/plan', {
        method: 'PUT',
        auth: 'bearer',
        body: { plan },
      }),
    usageHistory: (months = 6) =>
      api.request<UsagePeriod[]>('/api/platform/usage', { auth: 'tenant', query: { months } }),
    // ---- Tenant: facturación ----
    /** Datos para pagar (SINPE o transferencia), configurados en el servidor. */
    billingInfo: () => api.request<BillingInfo>('/api/platform/billing', { auth: 'tenant' }),
    /** Datos fiscales del tenant. Responde 404 si aún no se han rellenado. */
    billingProfile: () => api.request<BillingProfile>('/api/platform/billing-profile', { auth: 'tenant' }),
    saveBillingProfile: (body: BillingProfile) =>
      api.request<BillingProfile>('/api/platform/billing-profile', {
        method: 'PUT',
        auth: 'tenant',
        body,
      }),
    invoices: (take = 50) =>
      api.request<Invoice[]>('/api/platform/invoices', { auth: 'tenant', query: { take } }),
    /** Declara el pago. No la da por pagada: la deja en revisión hasta que se comprueba. */
    reportPayment: (invoiceId: string, body: ReportPaymentRequest) =>
      api.request<Invoice>(`/api/platform/invoices/${invoiceId}/payment`, {
        method: 'POST',
        auth: 'tenant',
        body,
      }),

    audit: (params: { action?: string; userId?: string; skip?: number; take?: number } = {}) =>
      api.request<Paged<AuditEntry>>('/api/platform/audit', {
        auth: 'tenant',
        query: { take: 100, ...params },
      }),
    /**
     * CSV con BOM, para que Excel abra bien los acentos. Devuelve la URL y las cabeceras en vez
     * del contenido: en móvil el archivo se baja a disco (expo-file-system) o se comparte, no se
     * carga en memoria.
     */
    exportContacts: (accountId: string) =>
      api.downloadRequest('/api/platform/contacts/export', { accountId }),
    /** El CSV necesita al menos la columna waId; los existentes se actualizan, no se duplican. */
    importContacts: (accountId: string, form: FormData) =>
      api.request<ImportContactsResult>('/api/platform/contacts/import', {
        method: 'POST',
        auth: 'tenant',
        formData: form,
        query: { accountId },
      }),

    // ---- Tenant: WABA (respuestas crudas de Graph API, en snake_case) ----
    wabaStatus: (accountId: string) =>
      api.request<Record<string, unknown>>(`/api/accounts/${accountId}/waba/status`, {
        auth: 'tenant',
      }),
    wabaPhoneNumbers: (accountId: string) =>
      api.request<Record<string, unknown>>(`/api/accounts/${accountId}/waba/phone-numbers`, {
        auth: 'tenant',
      }),
    wabaProfile: (accountId: string) =>
      api.request<Record<string, unknown>>(`/api/accounts/${accountId}/waba/profile`, {
        auth: 'tenant',
      }),
    updateWabaProfile: (accountId: string, body: UpdateBusinessProfileRequest) =>
      api.request<Record<string, unknown>>(`/api/accounts/${accountId}/waba/profile`, {
        method: 'PUT',
        auth: 'tenant',
        body,
      }),
    wabaSubscription: (accountId: string) =>
      api.request<Record<string, unknown>>(`/api/accounts/${accountId}/waba/subscription`, {
        auth: 'tenant',
      }),
    /**
     * Diagnóstico de los webhooks entrantes: URL de callback, estado de las credenciales,
     * últimos eventos aceptados y los rechazos con su motivo.
     */
    webhookDiagnostics: (accountId: string) =>
      api.request<WebhookDiagnostics>(`/api/accounts/${accountId}/waba/webhook-diagnostics`, {
        auth: 'tenant',
      }),
    subscribeWaba: (accountId: string) =>
      api.request<Record<string, unknown>>(`/api/accounts/${accountId}/waba/subscription`, {
        method: 'POST',
        auth: 'tenant',
      }),
    unsubscribeWaba: (accountId: string) =>
      api.request<Record<string, unknown>>(`/api/accounts/${accountId}/waba/subscription`, {
        method: 'DELETE',
        auth: 'tenant',
      }),
    /** Nivel de throughput del número: el estándar ronda 80 mensajes/s; el alto, 1.000. */
    wabaThroughput: (accountId: string) =>
      api.request<Record<string, unknown>>(`/api/accounts/${accountId}/waba/throughput`, {
        auth: 'tenant',
      }),
    /** Lo concede Meta según histórico y calidad: puede tardar o denegarse. */
    requestHighThroughput: (accountId: string) =>
      api.request<Record<string, unknown>>(`/api/accounts/${accountId}/waba/throughput/upgrade`, {
        method: 'POST',
        auth: 'tenant',
      }),

    // ---- Tenant: alta guiada de WhatsApp (Embedded Signup) ----
    onboardingConfig: () =>
      api.request<EmbeddedSignupConfig>('/api/onboarding/config', { auth: 'tenant' }),
    /** Canjea el código del popup de Meta. Caduca en segundos: hay que llamar en cuanto llega. */
    completeOnboarding: (body: CompleteSignupRequest) =>
      api.request<EmbeddedSignupResult>('/api/onboarding/complete', {
        method: 'POST',
        auth: 'tenant',
        body,
      }),

    // ---- Tenant: bitácora de eventos de webhook (Meta) ----
    listWebhookEvents: (take = 50, field?: string) =>
      api.request<WebhookEventRow[]>('/api/webhook-events', {
        auth: 'tenant',
        query: { take, field },
      }),

    // ---- Tenant: almacenamiento / archivos ----
    storageInfo: () => api.request<{ provider: string }>('/api/storage', { auth: 'tenant' }),
    uploadFile: (form: FormData, name?: string) =>
      api.request<{ key: string; size: number; contentType: string; provider: string }>(
        '/api/files',
        { method: 'POST', auth: 'tenant', formData: form, query: name ? { name } : undefined },
      ),
    deleteFile: (key: string) =>
      api.request<void>(`/api/files/${key}`, { method: 'DELETE', auth: 'tenant' }),
  };
}

export type Endpoints = ReturnType<typeof makeEndpoints>;
