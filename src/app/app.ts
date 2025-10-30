import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from './components/shared/navbar/navbar.component';
import { FooterComponent } from './components/shared/footer/footer.component';
import { OfferStripComponent } from './components/shared/offer-strip/offer-strip.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, NavbarComponent, OfferStripComponent, FooterComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('clayshan');
}
