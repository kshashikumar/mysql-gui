import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { LayoutHorizontalComponent } from '@lib/components';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, RouterModule, LayoutHorizontalComponent],
  templateUrl: './landing.component.html'
})
export class LandingComponent implements OnInit {
  constructor() {
    console.log('LandingComponent constructor called');
  }

  ngOnInit(): void {
    // Any initialization logic can go here
    console.log('LandingComponent initialized');
  }
}
