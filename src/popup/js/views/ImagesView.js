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

    // Performance optimization: debounce dropdown updates
    this._dropdownUpdatePending = false;
    this._dropdownUpdateTimeout = null;
    this._pendingDimensions = new Set();
    this._lastKnownDimensions = new Set();

    // Initialize Select2 on dimension filter when DOM is ready
    this._initSelect2();

    // Listen for <img> load events inside the container (capture = true)
    // so we can update sizes even when images load after render.
    this._parent.addEventListener('load', this._onImgLoad.bind(this), true);
  }

  _initSelect2() {
    if (!this._dimensionFilter) return;
    
    // Wait for jQuery and Select2 to be loaded
    const initSelect2 = () => {
      if (typeof jQuery !== 'undefined' && jQuery.fn.select2) {
        this._$dimensionFilter = jQuery(this._dimensionFilter);
        this._$dimensionFilter.select2({
          placeholder: 'Select dimensions...',
          allowClear: true,
          width: '100%',
          closeOnSelect: false
        });
      } else if (typeof $ !== 'undefined' && $.fn.select2) {
        this._$dimensionFilter = $(this._dimensionFilter);
        this._$dimensionFilter.select2({
          placeholder: 'Select dimensions...',
          allowClear: true,
          width: '100%',
          closeOnSelect: false
        });
      } else {
        // Retry after a short delay if jQuery/Select2 not yet loaded
        setTimeout(initSelect2, 50);
      }
    };

    // Try to initialize immediately, or wait for DOMContentLoaded
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initSelect2);
    } else {
      initSelect2();
    }
  }

  addHandlerDimensionFilter(handler) {
    if (!this._dimensionFilter) return;

    const setupHandler = () => {
      if (this._$dimensionFilter && this._$dimensionFilter.data('select2')) {
        // Select2 is initialized
        this._$dimensionFilter.on('change', (e) => {
          const selectedValues = this._$dimensionFilter.val() || [];
          // If "All dimensions" is selected, clear all other selections and show all
          if (selectedValues.includes('')) {
            // Clear all other selections
            this._$dimensionFilter.val(['']).trigger('change');
            handler([]);
          } else {
            // Use only the selected dimension values
            handler(selectedValues);
          }
        });
      } else {
        // Fallback to native change event
        this._dimensionFilter.addEventListener('change', (e) => {
          const selectedOptions = Array.from(e.target.selectedOptions);
          const selectedValues = selectedOptions.map(option => option.value);
          // If "All dimensions" is selected, clear all other selections and show all
          if (selectedValues.includes('')) {
            // Clear all other selections
            Array.from(e.target.options).forEach(opt => {
              if (opt.value !== '') opt.selected = false;
            });
            handler([]);
          } else {
            // Use only the selected dimension values
            handler(selectedValues);
          }
        });
      }
    };

    // Wait a bit for Select2 to initialize
    setTimeout(setupHandler, 100);
  }

  // Override render so we can update dimensions right after DOM is inserted
  render(data) {
    super.render(data);
    // Reset dimension tracking for new render
    this._lastKnownDimensions.clear();
    this._pendingDimensions.clear();
    this._updateAllLoadedImageDims();
  }

  _buildMarkUp() {
    let markup = ``;

    this._data.forEach(function (img, i) {
      markup += `
        <div data-id="${i}" id="card_${i}" class="card ${img.checked ? 'checked' : ''}" style="min-height: 200px;">
          <img src="${img.src}" style="min-width: 50px; max-width: 200px;">

          <!-- ✅ Dimensions label -->
          <div class="image_dims_container"
               style="position:absolute; left:6px; bottom:6px; padding:2px 6px; border-radius:6px;
                      font-size:12px; background:rgba(0,0,0,0.6); color:#fff; max-width:90%;">
            <span class="image_dims">Loading…</span>
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
      dimsEl.textContent = `${w} × ${h}px`;
      
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

    // Get dimensions from model
    const imageDimensions = getState('imageDimensions') || {};

    // Collect unique dimensions
    const uniqueDimensions = new Set();
    Object.values(imageDimensions).forEach((dim) => {
      if (dim) uniqueDimensions.add(dim);
    });

    // Check if we actually have new dimensions to add
    const existingOptions = new Set();
    Array.from(this._dimensionFilter.options).forEach(opt => {
      if (opt.value !== '') {
        existingOptions.add(opt.value);
      }
    });

    // Only process if there are actually new dimensions
    const newDimensions = Array.from(uniqueDimensions).filter(dim => !existingOptions.has(dim));
    
    // If no new dimensions and we've already processed all known dimensions, skip
    if (newDimensions.length === 0 && 
        Array.from(uniqueDimensions).every(dim => this._lastKnownDimensions.has(dim))) {
      return;
    }

    // Get current user selection BEFORE any modifications - this is critical!
    // Use Select2's val() if available, otherwise fallback to native
    let currentSelected = [];
    if (this._$dimensionFilter && this._$dimensionFilter.data('select2')) {
      currentSelected = this._$dimensionFilter.val() || [];
    } else {
      currentSelected = Array.from(this._dimensionFilter.selectedOptions).map(opt => opt.value);
    }
    
    // Ensure "All dimensions" option exists
    let allOption = this._dimensionFilter.querySelector('option[value=""]');
    if (!allOption) {
      allOption = document.createElement('option');
      allOption.value = '';
      allOption.textContent = 'All dimensions';
      this._dimensionFilter.insertBefore(allOption, this._dimensionFilter.firstChild);
    }
    
    if (newDimensions.length > 0) {
      // Sort new dimensions by width then height
      const sortedNewDimensions = newDimensions.sort((a, b) => {
        const [w1, h1] = a.split('x').map(Number);
        const [w2, h2] = b.split('x').map(Number);
        if (w1 !== w2) return w1 - w2;
        return h1 - h2;
      });

      // OPTIMIZATION: Build all options first, then insert in batch
      // This is much faster than inserting one-by-one
      const optionsToInsert = sortedNewDimensions.map((dim) => {
        const [w, h] = dim.split('x');
        const option = document.createElement('option');
        option.value = dim;
        option.textContent = `${w} × ${h}`;
        return { option, dim, w: Number(w), h: Number(h) };
      });

      // Get all existing dimension options (excluding "All dimensions")
      const existingDimOptions = Array.from(this._dimensionFilter.options)
        .filter(opt => opt.value !== '')
        .map(opt => ({
          option: opt,
          dim: opt.value,
          w: Number(opt.value.split('x')[0]),
          h: Number(opt.value.split('x')[1])
        }));

      // Merge and sort all options together
      const allDimOptions = [...existingDimOptions, ...optionsToInsert].sort((a, b) => {
        if (a.w !== b.w) return a.w - b.w;
        return a.h - b.h;
      });

      // Remove all existing dimension options (keep "All dimensions")
      existingDimOptions.forEach(({ option }) => {
        if (option.parentNode) {
          option.parentNode.removeChild(option);
        }
      });

      // Insert all options in sorted order
      allDimOptions.forEach(({ option }) => {
        this._dimensionFilter.appendChild(option);
      });

      // Update known dimensions cache
      newDimensions.forEach(dim => this._lastKnownDimensions.add(dim));

      // If Select2 is initialized, trigger update to refresh the dropdown
      if (this._$dimensionFilter && this._$dimensionFilter.data('select2')) {
        // Use a more efficient Select2 update method
        this._$dimensionFilter.trigger('change.select2');
      }
    }
    
    // CRITICAL: Restore the user's selection that was captured at the start
    if (this._$dimensionFilter && this._$dimensionFilter.data('select2')) {
      // Use Select2's API to restore selection (only if selection changed)
      const currentVal = this._$dimensionFilter.val() || [];
      const needsUpdate = currentVal.length !== currentSelected.length ||
        !currentSelected.every(val => currentVal.includes(val));
      
      if (needsUpdate) {
        this._$dimensionFilter.val(currentSelected).trigger('change');
      }
    } else {
      // Fallback to native selection
      const currentNativeSelected = Array.from(this._dimensionFilter.selectedOptions).map(opt => opt.value);
      const needsUpdate = currentNativeSelected.length !== currentSelected.length ||
        !currentSelected.every(val => currentNativeSelected.includes(val));
      
      if (needsUpdate) {
        Array.from(this._dimensionFilter.options).forEach(opt => opt.selected = false);
        currentSelected.forEach(val => {
          const option = this._dimensionFilter.querySelector(`option[value="${val}"]`);
          if (option) option.selected = true;
        });
      }
    }
  }
}

export default new ImagesView('#images_container');