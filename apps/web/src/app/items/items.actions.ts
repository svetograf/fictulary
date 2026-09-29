import { CreateItem } from './item.model';

export class LoadItems {
  static readonly type = '[Items] Load';
}

export class AddItem {
  static readonly type = '[Items] Add';
  constructor(public readonly item: CreateItem) {}
}

export class RemoveItem {
  static readonly type = '[Items] Remove';
  constructor(public readonly id: string) {}
}
