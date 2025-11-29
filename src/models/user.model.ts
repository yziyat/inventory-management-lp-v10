export type UserRole = 'admin' | 'editor' | 'viewer';
export type UserStatus = 'pending' | 'approved' | 'rejected' | 'suspended';

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
}