/**
 * Hợp đồng API dùng chung giữa web (frontend/) và mobile/.
 *
 * Chỉ chứa type và interface — không có giá trị runtime, nên import bị xoá lúc
 * biên dịch và không cần cấu hình bundler ở hai phía.
 *
 * Đổi response ở backend thì sửa ở đây, cả hai app cùng thấy lỗi kiểu ngay.
 */

// ── API Response ────────────────────────────────────────────────────────────
export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  /** Mã lỗi máy đọc được, chỉ có ở response thất bại (xem backend/src/constants/errorCodes.js). */
  code?: string;
  meta?: { pagination?: PaginationMeta };
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

// ── User ─────────────────────────────────────────────────────────────────────
export type Role = 'user' | 'team_manager' | 'field_owner' | 'admin';

export interface User {
  id: string;
  email: string;
  username: string;
  fullName: string;
  avatar: string;
  phone: string;
  gender: 'male' | 'female' | 'other';
  roles: Role[];
  status: 'active' | 'inactive' | 'banned';
  emailVerified: boolean;
  location: { city: string; district: string };
  playerProfile: {
    positions: string[];
    skillLevel: string;
    bio: string;
    stats: {
      matchesPlayed: number;
      wins: number;
      draws: number;
      losses: number;
      eloRating: number;
    };
  };
  /** `mutedTypes` là danh sách chọn-không-nhận: rỗng nghĩa là nhận hết. */
  notifications: { push: boolean; mutedTypes: NotificationType[] };
  createdAt: string;
}

// ── Field ────────────────────────────────────────────────────────────────────
export interface SubFieldAvailability {
  subFieldId: string;
  name: string;
  fieldType: '5v5' | '7v7' | '11v11';
  surface: 'natural_grass' | 'artificial_grass' | 'concrete';
  isAvailable: boolean;
  bookedSlots: { startTime: string; endTime: string }[];
}

export interface SubField {
  _id: string;
  name: string;
  fieldType: '5v5' | '7v7' | '11v11';
  surface: 'natural_grass' | 'artificial_grass' | 'concrete';
  capacity: number;
  status: 'available' | 'maintenance' | 'closed';
}

/** Ghi đè giá cho một khoảng ngày cụ thể (lễ/Tết, giá theo mùa) — thay hẳn weekday/weekend gốc. */
export interface PriceOverride {
  _id: string;
  name: string;
  startDate: string;
  endDate: string;
  weekday: { morning: number; afternoon: number; evening: number };
  weekend: { morning: number; afternoon: number; evening: number };
}

/** Mã khuyến mãi của chủ sân — có thể giới hạn theo khung giờ, khoảng ngày và số lượt dùng. */
export interface Promotion {
  _id: string;
  code: string;
  type: 'percentage' | 'fixed';
  value: number;
  /** Rỗng = áp dụng cho toàn bộ khung giờ. */
  slots: ('morning' | 'afternoon' | 'evening')[];
  startDate: string;
  endDate: string;
  active: boolean;
  maxUses?: number;
  usedCount: number;
}

/** Báo giá trước khi đặt — trả về bởi `GET /fields/:id/price-quote`. */
export interface PriceQuote {
  totalPrice: number;
  basePrice: number;
  discount: number;
  promoCode: string | null;
  /** Có mặt khi mã khuyến mãi truyền lên không hợp lệ/hết hạn — báo giá vẫn trả về giá gốc. */
  promoError?: string;
}

export interface Field {
  _id: string;
  owner: Pick<User, 'id' | 'username' | 'fullName' | 'avatar' | 'phone'>;
  name: string;
  slug: string;
  description: string;
  images: string[];
  location: {
    address: string;
    city: string;
    district: string;
    ward: string;
    coordinates: { type: string; coordinates: [number, number] };
  };
  subFields: SubField[];
  pricing: {
    weekday: { morning: number; afternoon: number; evening: number };
    weekend: { morning: number; afternoon: number; evening: number };
  };
  priceOverrides: PriceOverride[];
  promotions: Promotion[];
  operatingHours: { open: string; close: string };
  amenities: string[];
  rules: string[];
  status: 'active' | 'inactive' | 'pending_approval';
  isVerified: boolean;
  /** Ghi chú của admin khi duyệt hoặc từ chối sân. */
  moderationNote?: string;
  moderatedAt?: string;
  rating: { average: number; count: number };
  totalBookings: number;
  createdAt: string;
}

// ── Booking ──────────────────────────────────────────────────────────────────
export interface Booking {
  _id: string;
  field: Pick<Field, '_id' | 'name' | 'location' | 'images' | 'pricing'> & { owner: string };
  subField: string;
  user: Pick<User, 'id' | 'username' | 'fullName' | 'avatar' | 'phone'>;
  date: string;
  startTime: string;
  endTime: string;
  duration: number;
  totalPrice: number;
  /** Giá trước khuyến mãi. Vắng mặt trên các booking tạo trước khi có tính năng khuyến mãi. */
  basePrice?: number;
  discount?: number;
  promoCode?: string | null;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show';
  paymentStatus: 'unpaid' | 'paid' | 'refunded';
  paymentMethod: 'cash' | 'bank_transfer' | 'online';
  notes: string;
  cancelReason?: string;
  createdAt: string;
}

/**
 * Booking như chủ sân nhìn thấy: sân con là sub-document nhúng trong Field nên
 * backend giải tên sẵn thay vì populate.
 */
export interface OwnerBooking extends Omit<Booking, 'field'> {
  field: Pick<Field, '_id' | 'name' | 'location'>;
  subFieldName: string;
  subFieldType: '5v5' | '7v7' | '11v11' | '';
  team?: Pick<Team, '_id' | 'name' | 'logo'>;
}

export interface OwnerStats {
  totalFields: number;
  activeFields: number;
  totalSubFields: number;
  averageRating: number;
  pendingBookings: number;
  confirmedBookings: number;
  todayBookings: number;
  upcomingBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  noShowBookings: number;
  monthRevenue: number;
  lastMonthRevenue: number;
}

/** Lịch sân của đội, như người quản lý đội nhìn thấy. */
export interface TeamBooking extends Omit<Booking, 'field'> {
  field: Pick<Field, '_id' | 'name' | 'location' | 'images'>;
  team?: Pick<Team, '_id' | 'name' | 'logo'>;
}

/** Một điểm trong biểu đồ doanh thu theo tháng của chủ sân. */
export interface OwnerRevenuePoint {
  month: string;
  label: string;
  revenue: number;
  bookings: number;
  completed: number;
  cancelled: number;
}

// ── Team ─────────────────────────────────────────────────────────────────────
export interface TeamMember {
  user: Pick<User, 'id' | 'username' | 'fullName' | 'avatar'> & {
    playerProfile?: { skillLevel: string; positions: string[] };
  };
  role: 'manager' | 'captain' | 'player';
  position: string;
  joinedAt: string;
  status: 'active' | 'inactive';
}

export interface TeamStats {
  matchesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  goalsScored: number;
  goalsConceded: number;
  eloRating: number;
}

export interface Team {
  _id: string;
  name: string;
  slug: string;
  logo: string;
  description: string;
  manager: Pick<User, 'id' | 'username' | 'fullName' | 'avatar'>;
  members: TeamMember[];
  homeCity: string;
  homeDistrict: string;
  skillLevel: 'beginner' | 'intermediate' | 'advanced' | 'professional';
  fieldSize: '5v5' | '7v7' | '11v11';
  maxMembers: number;
  isPublic: boolean;
  inviteCode?: string;
  tags: string[];
  stats: TeamStats;
  status: 'active' | 'inactive' | 'disbanded';
  createdAt: string;
}

// ── MatchRequest ──────────────────────────────────────────────────────────────
export interface MatchRequest {
  _id: string;
  requesterTeam: Pick<Team, '_id' | 'name' | 'logo' | 'slug'> & { stats: { eloRating: number }; manager: string };
  opponentTeam: Pick<Team, '_id' | 'name' | 'logo' | 'slug'> & { stats: { eloRating: number }; manager: string };
  requestedBy: Pick<User, 'id' | 'username' | 'fullName' | 'avatar'>;
  field?: Pick<Field, '_id' | 'name' | 'location' | 'images'>;
  date: string;
  startTime: string;
  endTime: string;
  fieldSize: '5v5' | '7v7' | '11v11';
  message: string;
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled' | 'completed';
  result?: {
    requesterScore: number;
    opponentScore: number;
    winner?: 'requester' | 'opponent' | 'draw';
    confirmedByRequester: boolean;
    confirmedByOpponent: boolean;
  };
  eloChange?: { requester: number; opponent: number };
  createdAt: string;
}

// ── Review ───────────────────────────────────────────────────────────────────
export interface Review {
  _id: string;
  field: string | Pick<Field, '_id' | 'name' | 'location' | 'images' | 'slug'>;
  user: Pick<User, 'id' | 'username' | 'fullName' | 'avatar'>;
  rating: number;
  comment: string;
  images: string[];
  likes: string[];
  ownerReply?: { comment: string; repliedAt: string };
  isVerified: boolean;
  createdAt: string;
}

/** Đánh giá như chủ sân nhìn thấy — backend chỉ populate tên và địa chỉ sân. */
export interface OwnerReview extends Omit<Review, 'field'> {
  field: Pick<Field, '_id' | 'name' | 'location'>;
}

// ── Notification ─────────────────────────────────────────────────────────────
/** Giữ khớp với `backend/src/constants/notifications.js`. */
export type NotificationType =
  | 'booking_created'
  | 'booking_confirmed'
  | 'booking_cancelled'
  | 'match_request_received'
  | 'match_request_answered'
  | 'match_result_submitted'
  | 'invoice_issued'
  | 'invoice_paid'
  | 'chat_message';

export interface Notification {
  _id: string;
  type: NotificationType;
  title: string;
  body: string;
  /** Đường dẫn trong app tới đối tượng liên quan; rỗng nghĩa là không có gì để mở. */
  link: string;
  /** null = chưa đọc. */
  readAt: string | null;
  createdAt: string;
}

// ── Chat ─────────────────────────────────────────────────────────────────────
/**
 * Lý do hai người bắt đầu nói chuyện. Giữ khớp với `backend/src/constants/chat.js`.
 *
 * Chỉ có nghĩa với hội thoại tay đôi; nhóm luôn mang `'direct'` vì nó không sinh ra từ
 * một lịch đặt hay trận đấu nào.
 */
export type ConversationContextType = 'direct' | 'booking' | 'match_request' | 'field';

/** Tay đôi hay nhóm nhiều người. */
export type ConversationType = 'direct' | 'group';

/** Vai trò trong nhóm: chỉ quản trị nhóm được thêm, gỡ thành viên và đổi tên. */
export type ParticipantRole = 'admin' | 'member';

/** Tin người gõ, hay dòng do server ghi khi nhóm đổi ("A đã thêm B vào nhóm"). */
export type ChatMessageKind = 'text' | 'system';

/** Hồ sơ rút gọn của người tham gia — vừa đủ vẽ một dòng trong hộp thư. */
export type ChatParticipantProfile = Pick<User, 'username' | 'fullName' | 'avatar' | 'roles'> & { _id: string };

export interface ConversationParticipant {
  user: ChatParticipantProfile;
  role: ParticipantRole;
  /** null = chưa mở hội thoại lần nào. */
  lastReadAt: string | null;
  unreadCount: number;
}

export interface Conversation {
  _id: string;
  type: ConversationType;
  participants: ConversationParticipant[];
  /** Tên nhóm. Rỗng với hội thoại tay đôi — ở đó tên hiển thị là tên người kia. */
  name: string;
  avatar: string;
  /** Người lập nhóm; vắng mặt ở hội thoại tay đôi. */
  createdBy?: string;
  context: { type: ConversationContextType; ref?: string };
  lastMessage: { body: string; sender: string; sentAt: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  _id: string;
  conversation: string;
  sender: ChatParticipantProfile;
  kind: ChatMessageKind;
  body: string;
  createdAt: string;
}

/**
 * Tên sự kiện WebSocket. Giữ khớp với `backend/src/socket/events.js` — sai một chữ thì
 * không có lỗi nào nổ ra, chỉ là tin nhắn lặng lẽ không tới nơi.
 */
export type ChatClientEvent = 'message:send' | 'conversation:read' | 'conversation:typing';
export type ChatServerEvent =
  | 'message:new'
  | 'conversation:read'
  | 'conversation:typing'
  | 'conversation:updated'
  | 'chat:error';

export interface NewMessageEvent {
  conversationId: string;
  message: ChatMessage;
}

export interface ConversationReadEvent {
  conversationId: string;
  /** Người vừa đọc — luôn là người kia, không phải chính mình. */
  userId: string;
  readAt: string;
}

export interface TypingEvent {
  conversationId: string;
  userId: string;
  isTyping: boolean;
}

/**
 * Nhóm vừa lập, vừa đổi tên, hoặc vừa thêm/gỡ thành viên.
 *
 * Người vừa bị gỡ cũng nhận sự kiện này, và họ sẽ không thấy mình trong `participants` —
 * đó chính là dấu hiệu để client bỏ nhóm khỏi hộp thư.
 */
export interface ConversationUpdatedEvent {
  conversation: Conversation;
}

/** Trả lời của server cho một sự kiện client gửi lên (callback `ack` của socket.io). */
export type ChatAck<T> =
  | { success: true; data: T }
  | { success: false; message: string; code?: string };

// ── Billing (chủ sân thuê nền tảng) ──────────────────────────────────────────
export type PlanCode = 'free' | 'basic' | 'pro';

export interface Plan {
  code: PlanCode;
  name: string;
  monthlyPrice: number;
  maxFields: number;
  maxSubFieldsPerField: number;
  /** -1 nghĩa là không giới hạn. */
  includedBookingsPerMonth: number;
  features: string[];
}

export interface Subscription {
  _id: string;
  owner: string;
  plan: PlanCode;
  status: 'active' | 'past_due' | 'cancelled';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  autoRenew: boolean;
  totalPaid: number;
  createdAt: string;
}

export type InvoiceStatus = 'pending' | 'awaiting_confirmation' | 'paid' | 'void';

export interface Invoice {
  _id: string;
  code: string;
  owner: string | Pick<User, 'id' | 'username' | 'fullName' | 'email' | 'avatar'>;
  plan: PlanCode;
  description: string;
  amount: number;
  periodStart: string;
  periodEnd: string;
  status: InvoiceStatus;
  dueDate: string;
  paymentReference: string;
  reportedAt?: string;
  paidAt?: string;
  voidReason?: string;
  paymentProvider: 'manual' | 'vnpay' | 'momo';
  gatewayTransactionId?: string;
  createdAt: string;
}

export interface SubscriptionUsage {
  totalFields: number;
  activeFields: number;
  totalSubFields: number;
  bookingsThisMonth: number;
  grossRevenueThisMonth: number;
}

export interface SubscriptionOverview {
  subscription: Subscription;
  plan: Plan;
  plans: Plan[];
  usage: SubscriptionUsage;
  outstandingInvoices: Invoice[];
  outstandingAmount: number;
}

// ── Admin ────────────────────────────────────────────────────────────────────
export interface PlatformOverview {
  users: {
    total: number;
    newThisMonth: number;
    owners: number;
    managers: number;
    admins: number;
    active: number;
    banned: number;
  };
  fields: { total: number; active: number; inactive: number; pendingApproval: number };
  teams: { total: number };
  reviews: { total: number };
  bookings: {
    total: number;
    thisMonth: number;
    pending: number;
    completed: number;
    cancelled: number;
    /** Tiền khách trả cho chủ sân — không phải doanh thu của nền tảng. */
    grossMerchandiseValue: number;
  };
  platformRevenue: {
    totalCollected: number;
    paidInvoices: number;
    collectedThisMonth: number;
    mrr: number;
    pendingAmount: number;
    awaitingConfirmationCount: number;
    awaitingConfirmationAmount: number;
  };
  planDistribution: { code: PlanCode; name: string; monthlyPrice: number; total: number; active: number }[];
}

export interface PlatformRevenuePoint {
  month: string;
  label: string;
  platformRevenue: number;
  paidInvoices: number;
  bookings: number;
  grossMerchandiseValue: number;
  newUsers: number;
}

/** Một chủ sân trong bảng theo dõi của admin: dùng bao nhiêu, trả bao nhiêu. */
export interface OwnerSummary {
  _id: string;
  username: string;
  fullName: string;
  email: string;
  avatar: string;
  phone: string;
  status: User['status'];
  createdAt: string;
  totalFields: number;
  activeFields: number;
  totalBookings: number;
  completedBookings: number;
  grossMerchandiseValue: number;
  plan: PlanCode;
  planName: string;
  subscriptionStatus: Subscription['status'];
  totalPaid: number;
  currentPeriodEnd?: string;
}

export interface OwnerDetail {
  owner: User;
  subscription: Subscription | null;
  plan: Plan;
  fields: Pick<Field, '_id' | 'name' | 'status' | 'isVerified' | 'rating' | 'totalBookings' | 'subFields' | 'location'>[];
  invoices: Invoice[];
  bookingsByStatus: Record<string, { count: number; value: number }>;
}

// ── Manager (quản lý đội bóng) ───────────────────────────────────────────────
export interface ManagerDashboard {
  teams: Team[];
  totals: {
    totalTeams: number;
    totalMembers: number;
    matchesPlayed: number;
    wins: number;
    draws: number;
    losses: number;
    winRate: number;
    averageElo: number;
  };
  pendingIncoming: number;
  pendingOutgoing: number;
  awaitingResult: number;
  upcomingMatches: MatchRequest[];
  upcomingBookings: (Omit<Booking, 'field' | 'user'> & {
    field: Pick<Field, '_id' | 'name' | 'location'>;
    team?: Pick<Team, '_id' | 'name' | 'logo'>;
  })[];
}
