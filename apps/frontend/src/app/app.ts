import { Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SettingsService } from './core/settings/settings.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: `<router-outlet />`,
})
export class App implements OnInit {
  private readonly settings = inject(SettingsService);

  ngOnInit(): void {
    void this.settings.load();
  }
}
