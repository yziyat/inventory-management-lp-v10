import { ChangeDetectionStrategy, Component, inject, signal, computed } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { User, UserRole, UserStatus } from '../../models/user.model';
import { ModalComponent } from '../shared/modal.component';
import { TranslationService } from '../../services/translation.service';
import { AuthService } from '../../services/auth.service';
import { ConfirmationService } from '../../services/confirmation.service';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-users',
  templateUrl: './users.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, ModalComponent],
  standalone: true,
})
export class UsersComponent {
  private apiService = inject(ApiService);
  // FIX: Add explicit type to injected FormBuilder.
  private fb: FormBuilder = inject(FormBuilder);
  private translationService = inject(TranslationService);
  private confirmationService = inject(ConfirmationService);
  private notificationService = inject(NotificationService);
  authService = inject(AuthService);
  t = this.translationService.currentTranslations;

  isModalOpen = signal(false);
  editingUser = signal<User | null>(null);
  users = this.apiService.users;
  userRoles: UserRole[] = ['admin', 'editor', 'viewer'];
  userStatuses: UserStatus[] = ['approved', 'suspended', 'pending'];

  // Filter users by status
  pendingUsers = computed(() => this.users().filter(u => u.status === 'pending'));
  approvedUsers = computed(() => this.users().filter(u => u.status !== 'pending' && u.status !== 'rejected'));

  userForm = this.fb.group({
    username: ['', Validators.required],
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    role: ['viewer' as UserRole, Validators.required],
    status: ['approved' as UserStatus, Validators.required],
    password: ['']
  });

  openAddModal() {
    this.editingUser.set(null);
    this.userForm.reset({ role: 'viewer', status: 'approved', password: '', username: '', firstName: '', lastName: '' });
    this.userForm.get('password')?.setValidators([Validators.required, Validators.minLength(4)]);
    this.userForm.get('password')?.updateValueAndValidity();
    this.isModalOpen.set(true);
  }

  openEditModal(user: User) {
    this.editingUser.set(user);
    this.userForm.get('password')?.clearValidators();
    this.userForm.patchValue({
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      status: user.status || 'approved',
      password: ''
    });
    this.userForm.get('password')?.updateValueAndValidity();
    this.isModalOpen.set(true);
  }

  closeModal() {
    this.isModalOpen.set(false);
    this.editingUser.set(null);
  }

  async onSubmit() {
    if (this.userForm.invalid) return;

    try {
      const formValue = this.userForm.value;
      if (this.editingUser()) {
        const userToUpdate: User = {
          ...this.editingUser()!,
          username: formValue.username!,
          firstName: formValue.firstName!,
          lastName: formValue.lastName!,
          role: formValue.role!,
          status: formValue.status!
        };
        if (formValue.password) {
          userToUpdate.password = formValue.password;
        }
        await this.apiService.updateUser(userToUpdate.id, userToUpdate);
        this.notificationService.showSuccess(this.t().common.saveSuccess);
      } else {
        // When admin adds user manually, set as approved
        const newUser = {
          ...formValue,
          status: 'approved' as const,
          emailVerified: true // Assume admin verified or doesn't need verification for manual add
        };
        await this.apiService.addUser(newUser as Omit<User, 'id'>);
        this.notificationService.showSuccess(this.t().common.addSuccess);
      }
      this.closeModal();
    } catch (error) {
      console.error("Failed to save user", error);
      this.notificationService.showError(this.translationService.translate('errors.failedToSaveUser'));
    }
  }

  async onDelete(user: User) {
    if (user.id === this.authService.currentUser()?.id) {
      this.notificationService.showError(this.translationService.translate('errors.cannotDeleteSelf'));
      return;
    }

    const title = this.translationService.translate('common.deleteConfirmationTitle');
    const message = this.translationService.translate('users.deleteConfirmation', { username: user.username });

    const confirmed = await this.confirmationService.confirm(title, message);

    if (confirmed) {
      try {
        await this.apiService.deleteUser(user.id);
        this.notificationService.showSuccess(this.t().common.deleteSuccess);
      } catch (error) {
        console.error("Failed to delete user", error);
        this.notificationService.showError(this.translationService.translate('errors.failedToDeleteUser'));
      }
    }
  }

  async onApprove(user: User) {
    this.editingUser.set(user);
    this.userForm.patchValue({
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      role: 'viewer', // Default to viewer, admin can change
      password: ''
    });
    this.userForm.get('password')?.clearValidators();
    this.userForm.get('password')?.updateValueAndValidity();
    this.isModalOpen.set(true);
  }

  async onReject(user: User) {
    const title = 'Reject User';
    const message = `Are you sure you want to reject ${user.firstName} ${user.lastName}? This will delete the account request.`;

    const confirmed = await this.confirmationService.confirm(title, message);

    if (confirmed) {
      try {
        await this.apiService.deleteUser(user.id);
        this.notificationService.showSuccess('User request rejected');
      } catch (error) {
        console.error("Failed to reject user", error);
        this.notificationService.showError('Failed to reject user');
      }
    }
  }

  // Override onSubmit to handle approval
  async onSaveUser() {
    if (this.userForm.invalid) return;

    try {
      const formValue = this.userForm.value;
      if (this.editingUser()) {
        const userToUpdate: User = {
          ...this.editingUser()!,
          username: formValue.username!,
          firstName: formValue.firstName!,
          lastName: formValue.lastName!,
          role: formValue.role!,
          status: 'approved' // Set to approved on save
        };
        if (formValue.password) {
          userToUpdate.password = formValue.password;
        }
        await this.apiService.updateUser(userToUpdate.id, userToUpdate);
        this.notificationService.showSuccess(this.t().common.saveSuccess);
      } else {
        // When admin adds user manually, set as approved
        const newUser = {
          ...formValue,
          status: 'approved' as const,
          emailVerified: true
        };
        await this.apiService.addUser(newUser as Omit<User, 'id'>);
        this.notificationService.showSuccess(this.t().common.addSuccess);
      }
      this.closeModal();
    } catch (error) {
      console.error("Failed to save user", error);
      this.notificationService.showError(this.translationService.translate('errors.failedToSaveUser'));
    }
  }
}