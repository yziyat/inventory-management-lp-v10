import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { User, UserRole } from '../../models/user.model';
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

  userForm = this.fb.group({
    username: ['', Validators.required],
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    role: ['viewer' as UserRole, Validators.required],
    password: ['']
  });



  openAddModal() {
    this.editingUser.set(null);
    this.userForm.reset({ role: 'viewer', password: '', username: '', firstName: '', lastName: '' });
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
          role: formValue.role!
        };
        if (formValue.password) {
          userToUpdate.password = formValue.password;
        }
        await this.apiService.updateUser(userToUpdate);
        this.notificationService.showSuccess(this.t().common.saveSuccess);
      } else {
        await this.apiService.addUser(formValue as Omit<User, 'id'>);
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
}