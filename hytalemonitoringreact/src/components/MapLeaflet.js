import React, {Component} from 'react';

import * as L from 'leaflet';
import '../css/map.css';

import {socket} from "./routing/Routes";
import {ResponsiveContainer} from "recharts";

let map;

let playersMarkers = {};

// Options
const options =
    {
        // Max zoom
        maxZoom: 17,

        // Min zoom
        minZoom: 12,

        // Map id
        id: 'HytaleMonitoringMap',

        // Tile size in px
        tileSize: 512,

        // Offset
        zoomOffset: 1,

        // If the zoom sent to the server is reversed
        zoomReverse: true
    };

class MapLeaflet extends Component {

    constructor(props) {
        super(props);

        let width = props.width; // = qs.parse(this.props.location.search, {ignoreQueryPrefix: true}).width;
        let height // = qs.parse(this.props.location.search, {ignoreQueryPrefix: true}).height;

        width = width ? +width : undefined;
        height = width ? (width / (16/9)) : undefined;

        this.state = {map: undefined, windowWidth: width, windowHeigh: height};

        // We have to gather the data of the map like the zones, the markers, the texts
    }

    initMap = () => {

        let instance = this;

        L.TileLayer.MyCustomLayer = L.TileLayer.extend({
            getTileUrl: function (coords) {

                let x = coords.x;
                let y = coords.y;
                let z = options.maxZoom - coords.z + options.zoomOffset;

                // We shift x and y to the middle
                x += (-Math.pow(2, (options.maxZoom - 1) - z));
                y += (-Math.pow(2, (options.maxZoom - 1) - z));

                // The is used not to calculate this value each time
                let twoPowZMinusOne = Math.pow(2, z - 1);

                /*
                x *= twoPowZMinusOne
                y *= twoPowZMinusOne


                 */
                let letCoords = {x: x, y: y, z: z}

                return L.TileLayer.prototype.getTileUrl.call(this, letCoords);
            }
        });

        L.tileLayer.myCustomLayer = function (templateUrl, options) {
            return new L.TileLayer.MyCustomLayer(templateUrl, options);
        }

        // We create the map
        map = L.map('mapid').setView([0, 0], 15);

        // We add the tileLayer which is connected to our API (Where we will be only able to have 6 levels of zoom from -1 to -6)
        // L.tileLayer.myCustomLayer('/api/tile/{x}/{y}/{z}', {
        L.tileLayer.myCustomLayer('http://localhost:8080/levels/level{z}/{x}_{y}.png', {
            attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, <a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
            maxZoom: options.maxZoom,
            minZoom: options.minZoom,
            id: 'HytaleMonitoringMap',
            tileSize: options.tileSize,
            zoomOffset: options.zoomOffset,
            zoomReverse: options.zoomReverse
        }).addTo(map);

        // We change the text of the right side of the screen
        document.getElementsByClassName('leaflet-control-attribution')[0].innerHTML = '<span>Made with <span style="color: red">❤</span> by <a href="localhost" title="Website to monitor your Hytale server">HytaleMonitoringProject</a> with <a href="https://leafletjs.com" title="A JS library for interactive maps">Leaflet</a></span>';

        // Add the coordinates box
        document.querySelector(".leaflet-bottom.leaflet-left").innerHTML = `<div class="coordinates-box leaflet-control"><span id="coordinates-span">Coordinates: </span></div>`

        // Set the default coordinates
        instance.changeCoordinates(10, 255)

        // Get the current zoom value as it is sent to the server
        const getZoom = () => {

            // Get the zoom level of the map
            let zoomLevel = map.getZoom();

            // We check if the zoom calculation is reversed
            if (options.zoomReverse) {
                zoomLevel = options.maxZoom - zoomLevel;
            }

            // We return the zoom with the offset
            return zoomLevel + 1;
        };

        // This is used to get the coordinate
        map.addEventListener('mousemove', function (event) {

            // Get the lat and the lng of the mouse
            let lat = event.latlng.lat;
            let lng = event.latlng.lng;

            // Get the world coordinate of the cursor
            const [x, z] = instance.getWorldPositionFromLatLng(lat, lng)

            // Change the coordinates displayed
            instance.changeCoordinates(Math.floor(x), Math.floor(z))
        });
    }

    // Get the current zoom value as it is sent to the server
    getZoom = () => {

        // Get the zoom level of the map
        let zoomLevel = map.getZoom();

        // We check if the zoom calculation is reversed
        if (options.zoomReverse) {
            zoomLevel = options.maxZoom - zoomLevel;
        }

        // We return the zoom with the offset
        return zoomLevel + 1;
    };

    getWorldPositionFromLatLng = (lat, lng) => {
        let point = map.project(L.latLng(lat, lng), map.getZoom());

        // Get the x and z relative to the tile size in pixel
        let x = point.x / options.tileSize;
        let z = point.y / options.tileSize;

        // The is used not to calculate this value each time
        let twoPowZMinusOne = Math.pow(2, this.getZoom() - 1);

        // Shift the x and z
        x -= (1 << map.getZoom() - 2);
        z -= (1 << map.getZoom() - 2);

        // And apply the "ratio"
        x *= 16 * twoPowZMinusOne;
        z *= 16 * twoPowZMinusOne;

        return [x, z];
    }

    getLatLngFromWorldPosition = (x, z) => {

        // The is used not to calculate this value each time
        let twoPowZMinusOne = Math.pow(2, this.getZoom() - 1);

        // Apply the "ratio"
        x /= 16 * twoPowZMinusOne;
        z /= 16 * twoPowZMinusOne;

        // Shift the x and z
        x += (1 << map.getZoom() - 2);
        z += (1 << map.getZoom() - 2);

        // Get the x and z relative to the tile size in pixel
        let point = L.point(x * options.tileSize, z * options.tileSize);

        // Get the latlng
        let latlng = map.unproject(point, map.getZoom());

        // Return the result
        return [latlng.lat, latlng.lng]
    }

    changeCoordinates = (x, z) => {
        document.getElementById("coordinates-span").innerHTML = `Coordinates: (<strong>X</strong>:${x}, <strong>Z</strong>:${z})`
    }

    // Highlight a given chunk
    highlightChunkLatLng = (lat1, lng1, lat2, lng2, color = "red") => {
        L.rectangle([[lat1, lng1], [lat2, lng2]], {
            color: color,
            fillColor: color,
            fillOpacity: 0.5,
        }).addTo(map);
    };

    highlightChunkWorldPosition = (x1, y1, x2, y2, color = "red") => {

        let latLng1 = this.getLatLngFromWorldPosition(x1, y1)
        let latLng2 = this.getLatLngFromWorldPosition(x2, y2)

        L.rectangle([latLng1, latLng2], {
            color: color,
            fillColor: color,
            fillOpacity: 0.5,
        }).addTo(map);
    };

    // When the component has been mounted we can proceed with the map
    componentDidMount() {

        // SocketIO part
        socket.emit("initial_data");

        // When we receive a playersEvent message we handle it
        // It will contain the players infos
        socket.on("playersEvent", this.onPlayerEventHandle);

        this.initMap();

        this.highlightChunkWorldPosition(0, 0, 31, 31, "white")

        // We can change the height of the map
        let mapWidth = document.getElementById("mapid").getBoundingClientRect().width;

        document.getElementById("mapid").style.height = mapWidth / (16/9) + 'px';

        console.log(mapWidth)
    }

    /* Removing the listener before unmounting the component in order to avoid addition of multiple listener at the time revisit*/
    componentWillUnmount() {
        socket.off("playersEvent");
    }

    // Handle the playersEvent
    onPlayerEventHandle = (message) => {

        // We want to have a list of the players in the message to know if someone is not disconnected
        let playersOnline = [];

        // We want to loop trough all the players
        for (const [player, position] of Object.entries(message)) {

            playersOnline.push(player);

            // Create popup if not exists
            if (!playersMarkers.hasOwnProperty(player)) {

                // Create a marker and bind it to the player
                let marker = L.marker(this.getLatLngFromWorldPosition(position.x, position.z), {
                    icon: L.icon({
                        iconUrl: `https://minotar.net/avatar/${player}/32.png`,
                        iconSize: [32, 32],
                        iconAnchor: [0, 0],
                        popupAnchor: [16, -8]
                    })
                }).addTo(map);
                marker.bindPopup(player);

                // Add the marker to the array
                playersMarkers[player] = marker;
            }

            // Else we move it
            else {
                playersMarkers[player].setLatLng(this.getLatLngFromWorldPosition(position.x, position.z))
            }
        }

        // At the end we want to remove the players that have been disconnected thus we compare the array of online users and the array we have in local
        Object.keys(playersMarkers).filter((p) => {
            return !playersOnline.includes(p)
        }).forEach((p) => {
            // Remove the marker and the entry
            map.removeLayer(playersMarkers[p])
            delete playersMarkers[p]
        })
    }

    onDisconnect = () => {
        // socket.disconnect();
    }

    render() {

        return (
                <div style={{height: this.state.windowHeigh, width: this.state.windowWidth}} id="mapid">

                </div>
        );
    }
}

export default MapLeaflet;
