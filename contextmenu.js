// for submenus see: https://codepen.io/lublak/pen/mdmEdKN

function ContextMenu(wrapper, menuWrapper, structure, type='contextmenu') {
    this.wrapper = wrapper;
    this.menuWrapper = menuWrapper
    this.structure = structure;

    this.setup();
    this.setupEvents(wrapper, type);
}

ContextMenu.prototype = {
    setup() {
        const dropdownContent = this.menuWrapper.getElementsByClassName('dropdown-content')[0];
        const tpl = dropdownContent.getElementsByClassName('dropdown-item-template')[0];
        const tplDiv = dropdownContent.getElementsByClassName('dropdown-item-template-divider')[0];

        for (let i = 0; i < this.structure.length; i++) {
            const item = this.structure[i];

            if (item === 'divider') {
                const el = tplDiv.content.cloneNode(true);
                dropdownContent.appendChild(el);
                continue;
            }

            if (item.hasOwnProperty('context') && !item.context) {
                continue;
            }

            const el = tpl.content.cloneNode(true);
            const elA = el.querySelector('.dropdown-item');
            elA.innerText = item.name;
            if (item.hasOwnProperty('onclick')) {
                elA.addEventListener('mousedown', (e) => {
                    item.onclick(e);
                });
            }
            dropdownContent.appendChild(el);
        }

        this.menuWrapper.classList.remove('is-active');
    },

    showMenu(e) {
        this.menuWrapper.classList.add('is-active');
        const scaleX = this.wrapper.getBoundingClientRect().width / this.wrapper.offsetWidth;
        const scaleY = this.wrapper.getBoundingClientRect().height / this.wrapper.offsetHeight;
        let left = (e.x + this.wrapper.parentElement.scrollLeft - 20) / scaleX;
        let top = (e.y + this.wrapper.parentElement.scrollTop - 10) / scaleY;
        this.menuWrapper.style.left = left + 'px';
        this.menuWrapper.style.top = top + 'px';
        
        // adjust position if menu overflows
        const menuWrapper = this.menuWrapper.querySelector('#dropdown-menu-node'); // we need this element, because it has the size
        const rect = menuWrapper.getBoundingClientRect();
        const wrapperWidth = this.wrapper.offsetWidth;
        const wrapperHeight = this.wrapper.offsetHeight;

        if (rect.right > wrapperWidth) {
            left = (wrapperWidth - rect.width) / scaleX;
            left = Math.max(left, 0);
            this.menuWrapper.style.left = left + 'px';
        }
        if (rect.bottom > wrapperHeight) {
            top += (wrapperHeight - rect.bottom) / scaleY;  // we have to do this because the heights are different
            top = Math.max(top, 0);
            this.menuWrapper.style.top = top + 'px';
        }
    },

    hideMenu() {
        this.menuWrapper.classList.remove('is-active');
    },

    setClickEvent(elem, type, preventDefault=true) {
        elem.addEventListener(type, e => {
            this.showMenu(e);
            if (preventDefault) {
                e.preventDefault();
            }
        });
    },

    setupEvents(elem, type) {
        this.setClickEvent(elem, type);

        document.addEventListener('mousedown', e => {
            // always hide on left click
            if (e.button == 0) {
                this.hideMenu();
            }
        });
    }
}