from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from db.database import get_db
from models.menu import Category, MenuItem
from models.ingredient import Recipe, Ingredient
from schemas.menu import CategoryOut, MenuItemOut, MenuItemUpdate

router = APIRouter()


def compute_servings_left(item: MenuItem, db: Session) -> int:
    """Compute how many servings can be made from current stock."""
    recipes = db.query(Recipe).filter(Recipe.menu_item_id == item.id).all()
    if not recipes:
        return 999  # no recipe = unlimited
    min_servings = None
    for r in recipes:
        ing = db.query(Ingredient).filter(Ingredient.id == r.ingredient_id).first()
        if ing and r.qty_per_order > 0:
            possible = int(float(ing.qty) / float(r.qty_per_order))
            if min_servings is None or possible < min_servings:
                min_servings = possible
    return min_servings if min_servings is not None else 0


@router.get("/categories", response_model=List[CategoryOut])
def get_categories(db: Session = Depends(get_db)):
    return db.query(Category).order_by(Category.sort_order).all()


@router.get("/items", response_model=List[MenuItemOut])
def get_menu_items(db: Session = Depends(get_db)):
    items = db.query(MenuItem).filter(MenuItem.is_archived == False).order_by(MenuItem.id).all()
    result = []
    for item in items:
        servings = compute_servings_left(item, db)
        out = MenuItemOut(
            id=item.id,
            name=item.name,
            category_id=item.category_id,
            category_name=item.category.name if item.category else None,
            price=float(item.price),
            emoji=item.emoji,
            description=item.description,
            is_available=item.is_available,
            servings_left=servings,
        )
        result.append(out)
    return result


@router.patch("/items/{item_id}", response_model=MenuItemOut)
def update_menu_item(item_id: int, data: MenuItemUpdate, db: Session = Depends(get_db)):
    item = db.query(MenuItem).filter(MenuItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Menu item not found")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(item, field, value)
    db.commit()
    db.refresh(item)
    servings = compute_servings_left(item, db)
    return MenuItemOut(
        id=item.id,
        name=item.name,
        category_id=item.category_id,
        category_name=item.category.name if item.category else None,
        price=float(item.price),
        emoji=item.emoji,
        description=item.description,
        is_available=item.is_available,
        servings_left=servings,
    )
