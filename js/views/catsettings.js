// Réglages › Catégories : couleur de chaque catégorie, création / modification / suppression des
// catégories personnelles (nom, couleur, icône).

import * as expenses from '../expenses.js';
import {
  allCategories, getCategory, settingFor, PALETTE, ICON_CHOICES, MAX_CATEGORY_NAME, categoryBadge, badge, iconSvg
} from '../categories.js';
import { confirmDialog } from './dialog.js';
import { $, errorText } from './common.js';

let onChange = () => {};
let editingId = null;      // catégorie modifiée (ou null : nouvelle catégorie)
let color = 'bleu';
let icon = 'etoile';

// Liste dans Réglages.
export function render() {
  const ul = $('settings-categories');
  ul.textContent = '';
  for (const cat of allCategories()) {
    const li = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'cat-legend-row';
    const name = document.createElement('span');
    name.className = 'cat-legend-name';
    name.textContent = cat.name;
    const kind = document.createElement('span');
    kind.className = 'cat-kind';
    kind.textContent = cat.custom ? 'Perso' : '';
    const chevron = iconChevron();
    button.append(categoryBadge(cat.id), name, kind, chevron);
    button.addEventListener('click', () => openSheet(cat.id));
    li.appendChild(button);
    ul.appendChild(li);
  }
}

function iconChevron() {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'cat-legend-chevron');
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', 'M9 5l7 7-7 7');
  svg.appendChild(path);
  return svg;
}

// --- Feuille de modification ---

function updatePreview() {
  const cat = editingId ? getCategory(editingId) : null;
  const name = cat && !cat.custom ? cat.name : ($('catedit-name').value.trim() || 'Nouvelle catégorie');
  const preview = $('catedit-badge');
  preview.textContent = '';
  preview.appendChild(badge(cat && !cat.custom ? cat.icon : icon, color, name, 'cat-badge-large'));
  $('catedit-preview-name').textContent = name;
  for (const b of $('catedit-colors').children) b.setAttribute('aria-pressed', b.dataset.color === color ? 'true' : 'false');
  for (const b of $('catedit-icons').children) b.setAttribute('aria-pressed', b.dataset.icon === icon ? 'true' : 'false');
}

function openSheet(id) {
  const cat = id ? getCategory(id) : null;
  editingId = cat ? cat.id : null;
  const custom = !cat || cat.custom;
  color = cat ? cat.color : 'bleu';
  icon = cat ? cat.icon : 'etoile';
  $('catedit-title').textContent = !cat ? 'Nouvelle catégorie' : custom ? 'Modifier la catégorie' : cat.name;
  $('catedit-name').value = cat && custom ? cat.name : '';
  $('catedit-name-field').hidden = !custom;
  $('catedit-icons-field').hidden = !custom;
  $('catedit-builtin-note').hidden = custom;
  $('catedit-error').textContent = '';
  $('btn-catedit-delete').hidden = !cat || !cat.custom;
  // Catégorie intégrée dont la couleur a été changée : retour possible à la couleur d'origine.
  $('btn-catedit-reset').hidden = !cat || cat.custom || !settingFor(cat.id);
  updatePreview();
  $('catedit-sheet').hidden = false;
}

export function closeSheet() {
  editingId = null;
  $('catedit-sheet').hidden = true;
  $('catedit-form').reset();
}

async function onSave(event) {
  event.preventDefault();
  const cat = editingId ? getCategory(editingId) : null;
  const name = $('catedit-name').value.trim();
  if ((!cat || cat.custom) && !name) {
    $('catedit-error').textContent = 'Indique un nom.';
    return;
  }
  const taken = allCategories().some((c) => c.id !== editingId &&
    c.name.localeCompare(name, 'fr', { sensitivity: 'base' }) === 0);
  if ((!cat || cat.custom) && taken) {
    $('catedit-error').textContent = 'Une catégorie porte déjà ce nom.';
    return;
  }
  try {
    await expenses.saveCategory({ catId: editingId, color, name, icon });
    closeSheet();
    onChange();
  } catch (err) {
    $('catedit-error').textContent = errorText("La catégorie n'a pas pu être enregistrée : ", err);
  }
}

async function onDelete() {
  const cat = editingId ? getCategory(editingId) : null;
  if (!cat || !cat.custom) return;
  const ok = await confirmDialog({
    title: 'Supprimer la catégorie « ' + cat.name + ' » ?',
    message: 'Ses dépenses seront classées automatiquement, comme avant.',
    confirmLabel: 'Supprimer',
    destructive: true
  });
  if (!ok) return;
  try {
    await expenses.deleteCategorySetting(cat.id);
    closeSheet();
    onChange();
  } catch (err) {
    $('catedit-error').textContent = errorText("La suppression n'a pas pu être faite : ", err);
  }
}

async function onReset() {
  try {
    await expenses.deleteCategorySetting(editingId);
    closeSheet();
    onChange();
  } catch (err) {
    $('catedit-error').textContent = errorText("La couleur n'a pas pu être remise : ", err);
  }
}

export function init(callbacks) {
  onChange = callbacks.onChange;
  $('catedit-name').maxLength = MAX_CATEGORY_NAME;
  for (const p of PALETTE) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'swatch pal-' + p.key;
    b.dataset.color = p.key;
    b.setAttribute('aria-label', p.name);
    b.addEventListener('click', () => { color = p.key; updatePreview(); });
    $('catedit-colors').appendChild(b);
  }
  for (const key of ICON_CHOICES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'icon-choice';
    b.dataset.icon = key;
    b.setAttribute('aria-label', 'Icône ' + key);
    b.appendChild(iconSvg(key));
    b.addEventListener('click', () => { icon = key; updatePreview(); });
    $('catedit-icons').appendChild(b);
  }
  $('catedit-name').addEventListener('input', updatePreview);
  $('btn-cat-add').addEventListener('click', () => openSheet(null));
  $('catedit-form').addEventListener('submit', onSave);
  $('btn-catedit-cancel').addEventListener('click', closeSheet);
  $('btn-catedit-delete').addEventListener('click', onDelete);
  $('btn-catedit-reset').addEventListener('click', onReset);
}
