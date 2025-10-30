import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { InViewDirective } from '../../../directives/in-view.directive';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [RouterLink, InViewDirective],
  styleUrls: ['./footer.component.scss'],
  templateUrl: './footer.component.html',
})
export class FooterComponent {
  currentYear = new Date().getFullYear();
}
