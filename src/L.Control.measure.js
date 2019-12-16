L.Control.Measure = L.Control.extend({
    options: {
        position: "bottomright",
        //  weather to use keyboard control for this plugin
        keyboard: true,
        //  shortcut to activate measure
        activeKeyCode: "M".charCodeAt(0),
        //  shortcut to cancel measure, defaults to 'Esc'
        cancelKeyCode: 27,
        //  line color
        lineColor: "black",
        //  line weight
        lineWeight: 2,
        //  line dash
        lineDashArray: "6, 6",
        //  line opacity
        lineOpacity: 1
    },

    initialize: function(options) {
        L.Util.setOptions(this, options);
    },

    onAdd: function(map) {
        var className = "leaflet-control leaflet-control-measure";
        this._container = L.DomUtil.create("div", className);

        if (this.options.keyboard) {
            L.DomEvent.on(document, "keydown", this._onKeyDown, this);
        }
        map.on("measureFire", () => {
            this.stop();
        });
        L.DomEvent.on(this._container, "click", L.DomEvent.stopPropagation)
            .on(this._container, "click", L.DomEvent.preventDefault)
            .on(this._container, "click", this.start, this);
        this._measuring = false;
        return this._container;
    },

    onRemove: function(map) {
        if (this.options.keyboard) {
            L.DomEvent.off(document, "keydown", this._onKeyDown, this);
        }

        map.off("measureFire");
        L.DomEvent.off(this._container, "click");
    },

    _createButton: function(html, title, className, container, fn, context) {
        var link = L.DomUtil.create("a", className, container);
        link.innerHTML = html;
        link.href = "#";
        link.title = title;

        L.DomEvent.on(link, "click", L.DomEvent.stopPropagation)
            .on(link, "click", L.DomEvent.preventDefault)
            .on(link, "click", fn, context)
            .on(link, "dbclick", L.DomEvent.stopPropagation);
        return link;
    },

    _toggleMeasure: function() {
        this._measuring = !this._measuring;
        if (this._measuring) {
            L.DomUtil.addClass(this._container, "leaflet-control-measure-on");
            this._startMeasuring();
        } else {
            L.DomUtil.removeClass(this._container, "leaflet-control-measure-on");
            this._stopMeasuring();
        }
    },
    toggleHighIcon() {
        if (this.high) {
            L.DomUtil.addClass(this._container, "high");
        } else {
            L.DomUtil.removeClass(this._container, "high");
        }
        this.high = !this.high;
    },
    start() {
        this._toggleMeasure();
    },
    stop() {
        this._toggleMeasure();
    },

    _startMeasuring: function() {
        this._oldCursor = this._map._container.style.cursor;
        this._map._container.style.cursor = "crosshair";
        this._doubleClickZoom = this._map.doubleClickZoom.enabled();
        this._map.doubleClickZoom.disable();
        this._isRestarted = false;

        L.DomEvent.on(this._map, "mousemove", this._mouseMove, this)
            .on(this._map, "click", this._mouseClick, this)
            .on(this._map, "dbclick", this._finishPath, this);

        if (!this._layerPaint) {
            this._layerPaint = L.layerGroup().addTo(this._map);
        }

        if (!this._points) {
            this._points = [];
        }
    },

    _stopMeasuring: function() {
        this._map._container.style.cursor = this._oldCursor;

        L.DomEvent.off(this._map, "mousemove", this._mouseMove, this)
            .off(this._map, "click", this._mouseClick, this)
            .off(this._map, "dbclick", this._finishPath, this);

        if (this._doubleClickZoom) {
            this._map.doubleClickZoom.enabled();
        }
        if (this._layerPaint) {
            this._layerPaint.clearLayers();
        }

        this._restartPath();
    },

    _mouseMove: function(e) {
        if (!e.latlng || !this._lastPoint) {
            return;
        }
        if (!this._layerPaintPathTemp) {
            //  customize style
            this._layerPaintPathTemp = L.polyline([this._lastPoint, e.latlng], {
                color: this.options.lineColor,
                weight: this.options.lineWeight,
                opacity: this.options.lineOpacity,
                clickable: false,
                dashArray: this.options.lineDashArray,
                breakTrans: true
            }).addTo(this._layerPaint);

            this._layerPaintPathTemp.bringToBack();
        } else {
            //  replace the current layer to the newest draw points
            this._layerPaintPathTemp
                .getLatLngs()
                .splice(0, 2, this._lastPoint, e.latlng);
            //  force path layer update
            this._layerPaintPathTemp.redraw();
        }

        if (this._tooltip) {
            if (!this._distance) {
                this._distance = 0;
            }
            this._updateTooltipPosition(e.latlng);
            var distance = e.latlng.distanceTo(this._lastPoint);
            this._updateTooltipDistance(this._distance + distance, distance, true);
        }
    },

    _mouseClick: function(e) {
        console.log("click");
        if (!e.latlng) {
            return;
        }

        if (this._isRestarted) {
            this._isRestarted = false;
            return;
        }

        if (this._lastPoint && this._tooltip) {
            if (!this._distance) {
                this._distance = 0;
            }

            this._updateTooltipPosition(e.latlng);
            var distance = e.latlng.distanceTo(this._lastPoint);
            this._updateTooltipDistance(this._distance + distance, distance);
            this._remember = this._tooltip;
            this._distance += distance;
        }

        this._createTooltip(e.latlng);

        if (this._lastPoint && !this._layerPaintPath) {
            this._layerPaintPath = L.polyline([this._lastPoint], {
                color: this.options.lineColor,
                weight: this.options.lineWeight,
                opacity: this.options.lineOpacity,
                clickable: false,
                breakTrans: true
            }).addTo(this._layerPaint);

            this._layerPaintPath.bringToBack();
        }

        //  push current point to the main layer
        if (this._layerPaintPath) {
            this._layerPaintPath.addLatLng(e.latlng);
        }

        if (this._lastPoint) {
            if (this._lastCircle) {
                this._lastCircle.off("click", this._finishPath, this);
            }
            this._lastCircle = this._createCircle(e.latlng).addTo(this._layerPaint);
            this._lastCircle.on("click", this._finishPath, this);
        } else {
            this._createCircle(e.latlng).addTo(this._layerPaint);
        }

        this._lastPoint = e.latlng;
    },

    _finishPath: function(e) {
        if (e) {
            L.DomEvent.preventDefault(e);
        }
        this._map._container.style.cursor = this._oldCursor;
        L.DomEvent.off(this._map, "mousemove", this._mouseMove, this)
            .off(this._map, "click", this._mouseClick, this)
            .off(this._map, "dbclick", this._finishPath, this);

        if (this._lastCircle) {
            this._lastCircle.off("click", this._finishPath, this);
        }

        if (this._tooltip) {
            //  when remove from map, the _icon property becomes null
            this._layerPaint.removeLayer(this._tooltip);
        }
        if (this._layerPaint && this._layerPaintPathTemp) {
            this._layerPaint.removeLayer(this._layerPaintPathTemp);
        }

        this.removeLinesEvent();

        //  clear everything
        this._restartPath();
    },

    removeLinesEvent() {
        if (this._remember && this._remember._icon) {
            var lastContent = this._remember._icon.childNodes[0].innerHTML;
            this._remember._icon.childNodes[0].innerHTML =
                lastContent + "<span>【关闭】</span>";
            var _self = this;
            this._remember.on("click", function(params) {
                _self.stop();
            });
        }
    },
    _restartPath: function() {
        this._distance = 0;
        this._lastCircle = undefined;
        this._lastPoint = undefined;
        this._tooltip = undefined;
        this._layerPaintPath = undefined;
        this._layerPaintPathTemp = undefined;

        //  flag to stop propagation events...
        this._isRestarted = true;
    },

    _createCircle: function(latlng) {
        return new L.CircleMarker(latlng, {
            color: "black",
            opacity: 1,
            weight: 1,
            fillColor: "white",
            fill: true,
            fillOpacity: 1,
            radius: 4,
            clickable: Boolean(this._lastCircle),
            breakTrans: true
        });
    },

    _createTooltip: function(position) {
        var icon = L.divIcon({
            className: "leaflet-measure-tooltip",
            iconAnchor: [-5, -5]
        });
        this._tooltip = L.marker(position, {
            icon: icon,
            clickable: false
        }).addTo(this._layerPaint);
    },

    _updateTooltipPosition: function(position) {
        this._tooltip.setLatLng(position);
    },

    _updateTooltipDistance: function(total, difference, movemark) {
        if (!this._tooltip._icon) {
            return;
        }
        var totalRound = this._formatDistance(total);
        var differenceRound = this._formatDistance(difference);
        if (movemark) {
            totalRound += "( 双击结束 )";
        }

        var text =
            '<div class="leaflet-measure-tooltip-total">' + totalRound + "</div>";
        if (differenceRound > 0 && totalRound !== differenceRound) {
            text +=
                '<div class="leaflet-measure-tooltip-difference">(+' +
                differenceRound +
                ")</div>";
        }
        this._tooltip._icon.innerHTML = text;
    },

    _formatDistance: function(val) {
        if (val < 1000) {
            return Math.round(val) + "m";
        } else {
            return Math.round((val / 1000 / 1.852) * 100) / 100 + "nm";
        }
    },

    _onKeyDown: function(e) {
        // key control
        switch (e.keyCode) {
            case this.options.activeKeyCode:
                if (!this._measuring) {
                    this._toggleMeasure();
                }
                break;
            case this.options.cancelKeyCode:
                //  if measuring, cancel measuring
                if (this._measuring) {
                    if (!this._lastPoint) {
                        this._toggleMeasure();
                    } else {
                        this._finishPath();
                        this._isRestarted = false;
                    }
                }
                break;
        }
    }
});

L.Map.mergeOptions({
    measureControl: false
});
L.control.measure = function(options) {
    return new L.Control.Measure(options);
};

L.Map.addInitHook(function() {
    if (this.options.measureControl) {
        this.measureControl = L.control.measure({
            //  control position
            position: "bottomright",
            //  weather to use keyboard control for this plugin
            keyboard: true,
            //  shortcut to activate measure
            activeKeyCode: "M".charCodeAt(0),
            //  shortcut to cancel measure, defaults to 'Esc'
            cancelKeyCode: 27,
            //  line color
            lineColor: "#0088fd",
            //  line weight
            lineWeight: 2,
            //  line dash
            lineDashArray: "6, 6",
            //  line opacity
            lineOpacity: 1
        });
        this.addControl(this.measureControl);
    }
});
