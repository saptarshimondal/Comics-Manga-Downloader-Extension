import View from './View';
import openIcon from '../../images/open.svg';
import downloadIcon from '../../images/download.svg';
import { dump, hasSomeParentTheClass } from '../helpers';
import { getState, setState } from '../model';

class ImagesView extends View {
  constructor(selector) {
    super(selector);
    this._card = this._parent.querySelector('.card');
    this._dimensionFilter = document.getElementById('dimensionFilter');
    this._selectedDimensions = [];
    this._dimensionFilterHandler = null;

    // Performance optimization: debounce dropdown updates
    this._dropdownUpdatePending = false;
    this._dropdownUpdateTimeout = null;
    this._pendingDimensions = new Set();
    this._lastKnownDimensions = new Set();

    // Listen for <img> load events inside the container (capture = true)
    // so we can update sizes even when images load after render.
    this._parent.addEventListener('load', this._onImgLoad.bind(this), true);
  }

  addHandlerDimensionFilter(handler) {
    if (!this._dimensionFilter) return;
    this._dimensionFilterHandler = handler;

    const trigger = this._dimensionFilter.querySelector('.dimension-filter-trigger');
    const dropdown = this._dimensionFilter.querySelector('.dimension-filter-dropdown');

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      this._dimensionFilter.classList.toggle('open');
    });
    trigger.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this._dimensionFilter.classList.toggle('open');
      }
    });

    dropdown.addEventListener('click', (e) => {
      const option = e.target.closest('.dimension-filter-option');
      if (!option) return;
      const value = option.dataset.value;
      if (value === '') {
        this._selectedDimensions = [];
        this._syncDimensionOptionsSelection();
        this._updateDimensionFilterDisplay();
        handler([]);
      } else {
        const idx = this._selectedDimensions.indexOf(value);
        if (idx >= 0) {
          this._selectedDimensions.splice(idx, 1);
        } else {
          this._selectedDimensions.push(value);
          this._selectedDimensions.sort((a, b) => {
            const [w1, h1] = a.split('x').map(Number);
            const [w2, h2] = b.split('x').map(Number);
            if (w1 !== w2) return w1 - w2;
            return h1 - h2;
          });
        }
        this._syncDimensionOptionsSelection();
        this._updateDimensionFilterDisplay();
        handler(this._selectedDimensions.length ? this._selectedDimensions.slice() : []);
      }
    });

    document.addEventListener('click', (e) => {
      if (!this._dimensionFilter.contains(e.target)) {
        this._dimensionFilter.classList.remove('open');
      }
    });
  }

  _updateDimensionFilterDisplay() {
    const placeholder = this._dimensionFilter.querySelector('.dimension-filter-placeholder');
    const choicesEl = this._dimensionFilter.querySelector('.dimension-filter-choices');
    if (!placeholder || !choicesEl) return;
    if (this._selectedDimensions.length === 0) {
      placeholder.style.display = '';
      choicesEl.style.display = 'none';
      choicesEl.innerHTML = '';
    } else {
      placeholder.style.display = 'none';
      choicesEl.style.display = 'flex';
      choicesEl.innerHTML = this._selectedDimensions.map(dim => {
        const [w, h] = dim.split('x');
        const label = `${w} x ${h}`;
        return `<span class="dimension-filter-choice" data-value="${dim}">${label}<button type="button" class="remove" aria-label="Remove">&#215;</button></span>`;
      }).join('');
      choicesEl.querySelectorAll('.remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const choice = e.target.closest('.dimension-filter-choice');
          if (choice) {
            const val = choice.dataset.value;
            this._selectedDimensions = this._selectedDimensions.filter(d => d !== val);
            this._syncDimensionOptionsSelection();
            this._updateDimensionFilterDisplay();
            if (this._dimensionFilterHandler) {
              this._dimensionFilterHandler(this._selectedDimensions.length ? this._selectedDimensions.slice() : []);
            }
          }
        });
      });
    }
  }

  _syncDimensionOptionsSelection() {
    const dropdown = this._dimensionFilter.querySelector('.dimension-filter-dropdown');
    if (!dropdown) return;
    dropdown.querySelectorAll('.dimension-filter-option').forEach(opt => {
      const v = opt.dataset.value;
      opt.classList.toggle('selected', v === '' ? this._selectedDimensions.length === 0 : this._selectedDimensions.includes(v));
    });
  }

  /** Set selected dimensions from outside (e.g. restore from storage). Updates UI. */
  setSelectedDimensions(dims) {
    this._selectedDimensions = Array.isArray(dims) ? dims.slice() : [];
    this._syncDimensionOptionsSelection();
    this._updateDimensionFilterDisplay();
  }

  // Override render so we can update dimensions right after DOM is inserted
  render(data) {
    super.render(data);

    // Reset dimension tracking for new render
    this._lastKnownDimensions.clear();
    this._pendingDimensions.clear();

    // First, set dimensions from data if provided (from content script)
    // This avoids needing to load images just to get dimensions
    this._setDimensionsFromData(data);
    
    // Then update any images that are already loaded (cached)
    this._updateAllLoadedImageDims();
  }
  
  // Set dimensions from data provided by content script (optimization)
  _setDimensionsFromData(data) {
    const imageDimensions = getState('imageDimensions') || {};
    
    data.forEach((img, i) => {
      if (img.width != null && img.height != null) {
        const w = Number(img.width);
        const h = Number(img.height);
        const dimString = `${w}x${h}`;
        const card = this._parent.querySelector(`#card_${i}`);
        if (card) {
          const dimsEl = card.querySelector('.image_dims');
          if (dimsEl) {
            dimsEl.textContent = `${w} x ${h}px`;
            card.dataset.dimensions = dimString;
          }
          
          // Store in model
          const imgType = img.type || (img.src.startsWith('data') ? 'data' : 'url');
          const imageKey = `${img.src}|${imgType}`;
          imageDimensions[imageKey] = dimString;
          
          // Track for dropdown update
          if (!this._lastKnownDimensions.has(dimString)) {
            this._pendingDimensions.add(dimString);
          }
        }
      }
    });
    
    setState('imageDimensions', imageDimensions);
    
    // Update dropdown if we have new dimensions
    if (this._pendingDimensions.size > 0) {
      this._scheduleDropdownUpdate();
    }
  }

  _buildMarkUp() {
    let markup = ``;

    this._data.forEach(function (img, i) {
      // Use provided dimensions if available, otherwise show "Loading..."
      const dimText = (img.width != null && img.height != null) ? `${Number(img.width)} x ${Number(img.height)}px` : 'Loading…';
      
      markup += `
        <div data-id="${i}" id="card_${i}" class="card ${img.checked ? 'checked' : ''}" style="min-height: 200px;">
          <img src="${img.src}" 
               loading="lazy" 
               style="min-width: 50px; max-width: 200px; max-height: 100%; width: auto; height: auto; object-fit: contain;">

          <!-- ✅ Dimensions label -->
          <div class="image_dims_container"
               style="position:absolute; left:6px; bottom:6px; padding:2px 6px; border-radius:6px;
                      font-size:12px; background:rgba(0,0,0,0.6); color:#fff; max-width:90%;">
            <span class="image_dims">${dimText}</span>
          </div>

          <div class="checkbox"></div>
          <div class="actions">
            <button type="button" data-url="${img.src}" class="open_image" title="Open in new tab"
              style="background-image: url(${openIcon});"></button>
            <button type="button" data-url="${img.src}" class="download_image" title="Download"
              style="background-image: url(${downloadIcon});"></button>
          </div>
          <div class="image_url_container">
            <input type="text" readonly="true" value="${img.src}">
          </div>
        </div>
      `;
    });

    return markup.trim();
  }

  // Called whenever an <img> inside #images_container loads
  _onImgLoad(e) {
    const el = e.target;
    if (!el || el.tagName !== 'IMG') return;
    this._setDimsForImg(el);
  }

  // Update any images that were already loaded (cache) right after render
  _updateAllLoadedImageDims() {
    const imgs = this._parent.querySelectorAll('img');
    // Process all cached images, but batch the dropdown update
    imgs.forEach((imgEl) => {
      if (imgEl.complete) this._setDimsForImg(imgEl);
    });
    // Ensure final update happens after all cached images are processed
    if (this._pendingDimensions.size > 0) {
      this._scheduleDropdownUpdate();
    }
  }

  _setDimsForImg(imgEl) {
    const card = imgEl.closest('.card');
    if (!card) return;

    const dimsEl = card.querySelector('.image_dims');
    if (!dimsEl) return;

    // Real intrinsic size
    let w = imgEl.naturalWidth;
    let h = imgEl.naturalHeight;

    // Fallbacks (helps some SVGs)
    if ((!w || !h) && (imgEl.width && imgEl.height)) {
      w = w || imgEl.width;
      h = h || imgEl.height;
    }

    const imageId = card.dataset.id;
    if (imageId === undefined) return;

    // Get the image src from the img element itself (more reliable)
    const imgSrc = imgEl.src;
    if (!imgSrc) return;
    
    // Determine type from src
    const imgType = imgSrc.startsWith('data') ? 'data' : 'url';
    const imageKey = `${imgSrc}|${imgType}`;

    if (w && h) {
      const dimString = `${w}x${h}`;
      dimsEl.textContent = `${w} x ${h}px`;
      
      // Store dimensions in the card's data attribute
      card.dataset.dimensions = dimString;
      
      // Store dimensions in model using unique key (src|type)
      const imageDimensions = getState('imageDimensions') || {};
      imageDimensions[imageKey] = dimString;
      setState('imageDimensions', imageDimensions);
      
      // Track new dimension for batched update
      if (!this._lastKnownDimensions.has(dimString)) {
        this._pendingDimensions.add(dimString);
        this._scheduleDropdownUpdate();
      }
    } else {
      dimsEl.textContent = `Unknown size`;
      card.dataset.dimensions = '';
      
      // Store empty dimension in model using unique key
      const imageDimensions = getState('imageDimensions') || {};
      imageDimensions[imageKey] = '';
      setState('imageDimensions', imageDimensions);
    }
  }

  // Schedule dropdown update with debouncing and batching
  _scheduleDropdownUpdate() {
    // Clear existing timeout
    if (this._dropdownUpdateTimeout) {
      clearTimeout(this._dropdownUpdateTimeout);
    }

    // If update is already pending, just mark that we have new dimensions
    if (this._dropdownUpdatePending) {
      return;
    }

    // Schedule update with debouncing (50ms - batches rapid image loads)
    this._dropdownUpdateTimeout = setTimeout(() => {
      this._dropdownUpdatePending = true;
      
      // Use requestAnimationFrame for smooth DOM updates
      requestAnimationFrame(() => {
        this._updateDimensionDropdown();
        this._dropdownUpdatePending = false;
        this._pendingDimensions.clear();
      });
    }, 50);
  }

  addHandlerRender(handler) {
    ['load'].forEach((ev) => window.addEventListener(ev, handler));
  }

  addHandlerSelection(handler) {
    this._parent.addEventListener('click', (e) => {
      if (
        hasSomeParentTheClass(e.target, 'card') &&
        e.target.nodeName !== 'BUTTON' &&
        e.target.nodeName !== 'INPUT'
      ) {
        const card = e.target.closest('div.card');

        if (card.classList.contains('checked')) {
          card.classList.remove('checked');
          handler(Number(card.dataset.id), false);
        } else {
          card.classList.add('checked');
          handler(Number(card.dataset.id), true);
        }
      }
    });

    this._addHandlerOpenSingleImage();
  }

  _addHandlerOpenSingleImage() {
    this._parent.addEventListener('click', function (e) {
      if (e.target.classList.contains('open_image')) {
        window.open(e.target.dataset.url, '_blank');
        window.close();
      }
    });
  }

  addHandlerDownloadSingleImage(handler) {
    this._parent.addEventListener('click', async function (e) {
      if (e.target.classList.contains('download_image')) {
        const { title, imageURL } = await handler(e.target.dataset.url);

        const link = document.createElement('a');
        link.href = imageURL;
        link.download = title;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    });
  }

  _updateDimensionDropdown() {
    if (!this._dimensionFilter) return;

    const dropdown = this._dimensionFilter.querySelector('.dimension-filter-dropdown');
    if (!dropdown) return;

    const imageDimensions = getState('imageDimensions') || {};
    const uniqueDimensions = new Set();
    Object.values(imageDimensions).forEach((dim) => {
      if (dim) uniqueDimensions.add(dim);
    });

    const existingOptions = new Set();
    dropdown.querySelectorAll('.dimension-filter-option').forEach(opt => {
      if (opt.dataset.value !== '') existingOptions.add(opt.dataset.value);
    });

    const newDimensions = Array.from(uniqueDimensions).filter(dim => !existingOptions.has(dim));
    if (newDimensions.length === 0 &&
        Array.from(uniqueDimensions).every(dim => this._lastKnownDimensions.has(dim))) {
      return;
    }

    if (newDimensions.length > 0) {
      const sortedNew = newDimensions.sort((a, b) => {
        const [w1, h1] = a.split('x').map(Number);
        const [w2, h2] = b.split('x').map(Number);
        if (w1 !== w2) return w1 - w2;
        return h1 - h2;
      });

      const existingDimOptions = Array.from(dropdown.querySelectorAll('.dimension-filter-option'))
        .filter(opt => opt.dataset.value !== '')
        .map(opt => ({
          el: opt,
          dim: opt.dataset.value,
          w: Number(opt.dataset.value.split('x')[0]),
          h: Number(opt.dataset.value.split('x')[1])
        }));

      const optionsToInsert = sortedNew.map((dim) => {
        const [w, h] = dim.split('x');
        const el = document.createElement('div');
        el.className = 'dimension-filter-option';
        el.dataset.value = dim;
        el.textContent = `${w} x ${h}`;
        return { el, dim, w: Number(w), h: Number(h) };
      });

      const allDimOptions = [...existingDimOptions.map(o => ({ el: o.el, dim: o.dim, w: o.w, h: o.h })), ...optionsToInsert]
        .sort((a, b) => (a.w !== b.w ? a.w - b.w : a.h - b.h));

      existingDimOptions.forEach(({ el }) => el.remove());
      allDimOptions.forEach(({ el }) => dropdown.appendChild(el));
      newDimensions.forEach(dim => this._lastKnownDimensions.add(dim));
    }

    this._syncDimensionOptionsSelection();
    this._updateDimensionFilterDisplay();
  }
}

export default new ImagesView('#images_container');