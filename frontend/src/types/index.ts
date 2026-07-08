// ── API Response ────────────────────────────────────────────────────────────
export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
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
  operatingHours: { open: string; close: string };
  amenities: string[];
  rules: string[];
  status: 'active' | 'inactive' | 'pending_approval';
  isVerified: boolean;
  rating: { average: number; count: number };
  totalBookings: number;
  createdAt: string;
}

// ── Booking ──────────────────────────────────────────────────────────────────
export interface Booking {
  _id: string;
  field: Pick<Field, '_id' | 'name' | 'location' | 'images' | 'pricing'>;
  subField: string;
  user: Pick<User, 'id' | 'username' | 'fullName' | 'avatar' | 'phone'>;
  date: string;
  startTime: string;
  endTime: string;
  duration: number;
  totalPrice: number;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show';
  paymentStatus: 'unpaid' | 'paid' | 'refunded';
  paymentMethod: 'cash' | 'bank_transfer' | 'online';
  notes: string;
  cancelReason?: string;
  createdAt: string;
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
  requesterTeam: Pick<Team, '_id' | 'name' | 'logo' | 'slug'> & { stats: { eloRating: number } };
  opponentTeam: Pick<Team, '_id' | 'name' | 'logo' | 'slug'> & { stats: { eloRating: number } };
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

// ── Auth ─────────────────────────────────────────────────────────────────────
export interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
}
