import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'library',
    loadComponent: () =>
      import('./features/library/library.component').then((m) => m.LibraryComponent),
  },
  {
    path: 'new',
    loadComponent: () =>
      import('./features/new-project/new-project.component').then((m) => m.NewProjectComponent),
  },
  {
    path: 'project/:id',
    loadComponent: () =>
      import('./features/project/project.component').then((m) => m.ProjectComponent),
  },
  {
    path: 'lesson/:id',
    loadComponent: () =>
      import('./features/lesson/lesson.component').then((m) => m.LessonComponent),
  },
  {
    path: 'settings',
    loadComponent: () =>
      import('./features/settings/settings.component').then((m) => m.SettingsComponent),
  },
  { path: '', pathMatch: 'full', redirectTo: 'library' },
  { path: '**', redirectTo: 'library' },
];
