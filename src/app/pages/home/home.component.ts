import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ProductService } from '../../services/product.service';
import { ProductCardComponent } from '../../components/shared/product-card/product-card.component';
import { SkeletonCardComponent } from '../../components/shared/skeleton-card/skeleton-card.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink, ProductCardComponent, SkeletonCardComponent],
  styleUrls: ['./home.component.scss'],
  templateUrl: './home.component.html',
})
export class HomeComponent implements OnInit {
  constructor(public productService: ProductService) {}
  ngOnInit(): void {
    this.productService.loadProducts();
  }
}
