export type UserRole = 'admin' | 'editor' | 'viewer';
export type UserStatus = 'pending' | 'approved' | 'rejected' | 'suspended';
export type Language = 'en' | 'fr';
export type DateFormat = 'YYYY-MM-DD' | 'DD/MM/YYYY';

export interface User {
  id: string;
  displayId?: number;
  username: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  status?: UserStatus;
  emailVerified?: boolean;
  password?: string;
  language?: Language;
  dateFormat?: DateFormat;
}