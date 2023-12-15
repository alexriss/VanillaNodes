// for imagezoom

function ZoomDrag(divMain) {
    const that = this;
    
    // config
    let scale = 1;  // initial scale
    let factor = 0.2;
    let max_scale = 3;
    let min_scale = 0.2;

    this.scale = scale;  // need a global variable here
    this.divMain = divMain;
    this.divMain.scrollTop = 0;
    this.divMain.scrollLeft = 0;    

    this.moveEnabled = false;  // set from outside

    // drag the section
    for (const divSection of divMain.getElementsByTagName('section')) {
        // when mouse is pressed store the current mouse x,y
        let previousX, previousY;
        divSection.addEventListener('mousedown', (e) => {
            previousX = e.pageX;
            previousY = e.pageY;
        })

        // when mouse is moved, scrollBy() the mouse movement x,y
        divSection.addEventListener('mousemove', (e) => {
            // only do this when the primary mouse button is pressed (e.buttons = 1)
            if (e.buttons) {
                let dragX = 0;
                let dragY = 0;
                // skip the drag when the x position was not changed
                if (e.pageX - previousX !== 0) {
                    dragX = previousX - e.pageX;
                    previousX = e.pageX;
                }
                // skip the drag when the y position was not changed
                if (e.pageY - previousY !== 0) {
                    dragY = previousY - e.pageY;
                    previousY = e.pageY;
                }

                if (!that.getMoveEnabled(e)) {
                    return;
                }

                // scrollBy x and y
                if (dragX !== 0 || dragY !== 0) {
                    divMain.scrollBy(dragX, dragY);
                }       
            }
        })
    }

    // zoom in/out on the section
    divMain.addEventListener('wheel', (e) => {
        // preventDefault to stop the onselectionstart event logic
        for (const divSection of divMain.getElementsByTagName('section')) {
            e.preventDefault();
            let delta = e.delta || e.wheelDelta;
            if (delta === undefined) {
                //we are on firefox
                delta = e.originale.detail;
            };
            delta = Math.max(-1, Math.min(1, delta)); // cap the delta to [-1,1] for cross browser consistency

            // change zoom
            let scale = that.scale + delta * factor * that.scale;
            scale = Math.max(min_scale, Math.min(max_scale, scale));

            const displayWidth = divSection.clientWidth * scale;
            const displayHeight = divSection.clientHeight * scale;
            if (divMain.clientHeight > displayHeight) {
                divMain.scrollTop = 0;
                return;
            }
            else if (divMain.clientWidth > displayWidth) {
                divMain.scrollLeft = 0;
                return;
            }

            const newScroll = this.getScroll(divMain, e, that.scale, scale);
            that.scale = scale;
            divSection.style.transform = `scale(${that.scale}, ${that.scale})`;
            divMain.scrollTop = newScroll.y;
            divMain.scrollLeft = newScroll.x;
        }
    })

    // reset on doubleclick
    divMain.addEventListener('dblclick', (e) => {
        if (!e.ctrlKey) {
            this.zoom_drag_reset(e, divMain);
        }
    })
}

ZoomDrag.prototype = {
    zoom_drag_reset(e, divMain) {
        const newScroll = this.getScroll(divMain, e, this.scale, 1);
        this.scale = 1;
        for (const divSection of divMain.getElementsByTagName('section')) {
            divSection.style.transform = "scale(1, 1)";
        }
        
        divMain.scrollTop = newScroll.y;
        divMain.scrollLeft = newScroll.x;
    },

    getScroll(divMain, e, scaleOld, scaleNew) {
        const offset = { x: divMain.scrollLeft, y: divMain.scrollTop };
        const rect = divMain.getBoundingClientRect();
        const imageLoc = {
            x: e.clientX - rect.left + offset.x,
            y: e.clientY - rect.top + offset.y
        };

        const zoomPoint = {
            x: imageLoc.x / scaleOld * scaleNew,
            y: imageLoc.y / scaleOld * scaleNew
        };

        const newScroll = {
            x: zoomPoint.x - (e.clientX - rect.left),
            y: zoomPoint.y - (e.clientY - rect.top)
        };
        return newScroll
    },

    getMoveEnabled() {
        return this.moveEnabled;
    },

    setMoveEnabled(moveEnabled) {
        this.moveEnabled = moveEnabled;
    }
}
