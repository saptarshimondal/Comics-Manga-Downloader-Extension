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

    // Listen for <img> load events inside the container (capture = true)
    // so we can update sizes even when images load after render.
    this._parent.addEventListener('load', this._onImgLoad.bind(this), true);
  }

  addHandlerDimensionFilter(handler) {
    if (this._dimensionFilter) {
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
  }

  // Override render so we can update dimensions right after DOM is inserted
  render(data) {
    super.render(data);
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
    imgs.forEach((imgEl) => {
      if (imgEl.complete) this._setDimsForImg(imgEl);
    });
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
      
      // Update dropdown options
      this._updateDimensionDropdown();
    } else {
      dimsEl.textContent = `Unknown size`;
      card.dataset.dimensions = '';
      
      // Store empty dimension in model using unique key
      const imageDimensions = getState('imageDimensions') || {};
      imageDimensions[imageKey] = '';
      setState('imageDimensions', imageDimensions);
    }
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

    // Get current user selection BEFORE any modifications - this is critical!
    const currentSelected = Array.from(this._dimensionFilter.selectedOptions).map(opt => opt.value);

    // Get existing option values (excluding "All dimensions")
    const existingOptions = new Set();
    Array.from(this._dimensionFilter.options).forEach(opt => {
      if (opt.value !== '') {
        existingOptions.add(opt.value);
      }
    });

    // Only add new dimension options that don't already exist
    const newDimensions = Array.from(uniqueDimensions).filter(dim => !existingOptions.has(dim));
    
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

      // Add new options in sorted position
      sortedNewDimensions.forEach((dim) => {
        // Find the right position to insert (maintain sorted order)
        let insertBefore = null;
        for (let i = 0; i < this._dimensionFilter.options.length; i++) {
          const opt = this._dimensionFilter.options[i];
          if (opt.value !== '' && opt.value !== dim) {
            // Compare dimensions to find insertion point
            const [w1, h1] = dim.split('x').map(Number);
            const [w2, h2] = opt.value.split('x').map(Number);
            if (w1 < w2 || (w1 === w2 && h1 < h2)) {
              insertBefore = opt;
              break;
            }
          }
        }
        
        const option = document.createElement('option');
        option.value = dim;
        const [w, h] = dim.split('x');
        option.textContent = `${w} × ${h}`;
        
        if (insertBefore) {
          this._dimensionFilter.insertBefore(option, insertBefore);
        } else {
          this._dimensionFilter.appendChild(option);
        }
      });
    }
    
    // CRITICAL: Restore the user's selection that was captured at the start
    // Clear all selections first
    Array.from(this._dimensionFilter.options).forEach(opt => opt.selected = false);
    
    // Restore the user's original selection
    currentSelected.forEach(val => {
      const option = this._dimensionFilter.querySelector(`option[value="${val}"]`);
      if (option) option.selected = true;
    });
  }
}

export default new ImagesView('#images_container');