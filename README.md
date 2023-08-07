<p align="center"><img align="" height="64" src="img/historyhelper-logo.svg"/></p>

![HistoryHelper Demo](./img/historyhelper-revisions.png)
> A JavaScript Wikipedia Plugin for History & Revisions pages

# HistoryHelper for Wikipedia  <img align="right" height="32" src="img/historyhelper-logo.svg"/>
The HistoryHelper plugin (HH) basically helps you to copy & past multiple entries to initiate a discussion of concerning edits. It also can highlight offensive words. It was first pusblished on May 12, 2021.

## Install
You are assumed to have a wikipedia account in order to be able to install this script. Otherwise, you probably would need to install a browser extension that runs user-scripts instead. I do not consider to create a separate plugin for web the browser until paid.

### On wikipedia

> *See: [History Helper Install ](https://en.wikipedia.org/wiki/User:Alexander_Davronov/HistoryHelper#Install) instructions.*


## Usage
Plugin binds a few key strokes. See demons below.
* <kbd>click+drag</kbd> — on checkboxes to select multiple entries simultaneously.
* <kbd>⇧shift+click</kbd> — on checkbox to select multiple entries simultaneously.

### Demos
* <a href="./videos/HistoryHelper Pointer + Shift Demo.mp4">HistoryHelper Pointer + Shift Demo</a>
* <a href="./videos/HistoryHelper Pointer Hold & Drag Demo.mp4">HistoryHelper Pointer Hold & Drag Demo</a>

### Config

By default HH higlights some uncivil words (see line 839 for a fill list). You can add your own words or phrases by using the following config below. Use Regular expression for matching. By default every word is highlighted by using `{{Tl|highlight}}` wikipedia tag

```js
    window.HistoryHelper= window.HistoryHelper || {}; 
    window.HistoryHelper.highlights=[
     // matches liar 2 times, or pants, or "on fire" 
     /(liar){1,2}|pants|on fire/ig
    ];
```
## Limitations

### I18n
Currently this plugin doesn't international wikipedias (i.e. outside of en.wikipedia.orgdomain). Date locales may be parsed wrongly or with errors. 

## Security and Legal Statement
> _See also [LICENSE](./LICENSE)_

The plugin is open source and free of charge. It doesn't gather, store, or send any sensetive information. It never accesses your cookies, neither it tries to obtain any sensetive data via fake dialogs etc. Checkout the source code to make sure there is no suspicious code before using this plugin.


## Development
The plugin is written in JavaScript. The following [dot graph] approximates a script lifecycle and basic classes:
![Project LifeCycle](img/Wikipedia.HistoryHelper.gv.svg)

[dot graph]: "https://www.graphviz.org/"

### Script overview
On wikipedia page the script maps button actions into copying entries from the current page's revisions. Revisions are kept in an array class `Revisions`.

The main class is `HH`. It keeps actions map that maps UI button events into specific actions to be performed over `Revisions` instance (i.e. formatting & copying diff links into the system clipboard upon click)

When run, the script performs several steps:
* It maps DOM html revisions tree into a `Revisions` class
* Which further wraps every sub-entry (`<li>...<li/>` element) into `Entry` class
* Adds MediaWiki `ButtonWidget`-based UI buttons


### TODO
* Fetch revisions from wikipedia DATA/DB API.

-----
> Created-at: September 10, 2022</br>
> Modified-at: August 13, 2023
