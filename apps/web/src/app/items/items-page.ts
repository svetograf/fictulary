import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { dispatch, select } from '@ngxs/store';
import { AddItem, LoadItems, RemoveItem } from './items.actions';
import { ItemsState } from './items.state';

@Component({
  selector: 'app-items-page',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatListModule,
    MatProgressBarModule,
  ],
  templateUrl: './items-page.html',
  styleUrl: './items-page.scss',
})
export class ItemsPage implements OnInit {
  protected readonly items = select(ItemsState.items);
  protected readonly loading = select(ItemsState.loading);
  protected readonly error = select(ItemsState.error);

  private readonly loadItems = dispatch(LoadItems);
  private readonly addItem = dispatch(AddItem);
  protected readonly removeItem = dispatch(RemoveItem);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(200)]],
    description: [''],
  });

  ngOnInit(): void {
    this.loadItems();
  }

  protected submit(): void {
    if (this.form.invalid) {
      return;
    }
    const { name, description } = this.form.getRawValue();
    this.addItem({ name, description: description || undefined }).subscribe(
      () => this.form.reset(),
    );
  }
}
