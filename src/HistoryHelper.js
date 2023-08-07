// Version       : 2.6.7
// Last-modified :  August 07, 2023
// Author        : Alexander Davronov
// Description   : Toolbar for copying diff entries from revision/contributions
//                 pages history on Wikipedia

/***********************************************************************************
 ***********************************************************************************
 ** HistoryHelper (Wikipedia script)                                              **
 ** Copyright (C) 2021- Alex A. Davronov                                          **
 **                                                                               **
 ** THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR    **
 ** IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,      **
 ** FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE   **
 ** AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER        **
 ** LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING       **
 ** FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER           **
 ** DEALINGS IN THE SOFTWARE.                                                     **
 ***********************************************************************************
 ***********************************************************************************/

$(function() {
	"use strict";
	// -----------------------------------------------------------------------------
	// #BROWSER POLYFILLS
	// -----------------------------------------------------------------------------s
	if (!Object.assign) { Object.assign = jQuery.extend; }

	/**
	 * @param {string} message 
	 * @param {string} indent */
	var InvalidArgumentTypeError = class extends TypeError {
		constructor(message, indent) {
			indent = indent instanceof String ? indent : "";
			message = indent + "Invalid Argument: " + message;
			super(message);
		}
	};
	// -----------------------------------------------------------------------------
	// #UTILS
	// -----------------------------------------------------------------------------
	/*
	 * Makes clipboard (temporary buffer) managment easier
	 * @example: new ClipboardBuffer().copy('foo') // copies 'foo' string to the clipboard
	 * Borrowed from Collect tracks v.2.js
	 **/
	let ClipboardBuffer = class {
		static version = "1.0.0";
		constructor(container) {
			this.container = container || document.body;
			this.id = "clipboard-area";
			this.el = this.container.querySelector("#" + this.id);
			if (!this.el) {
				this.el = document.createElement("textarea");
				this.container.appendChild(this.el);
			}

			this.el.style.position = "absolute";
			this.el.style.top = "-9999px";
			this.el.contentEditable = true;
			this.el.id = this.id;
		}
		copy(text) {
			this.el.value = text;
			this.el.select();
			var result = document.execCommand("copy");
			this.el.blur();
			return result;
		}
	};
	/**
	 * Toolbar for buttons.
	 * This class is tasked with book keeping of buttons.
	 * It can retrieve buttons to assing listeners for both pointer and keyboard.
	 * element which you can style.
	 * @since 2.6.0
	 * @example
	 * let toolbar = new Wiki.Toolbar(document.getElementById(`some-panel`))
	 *     toolbar.addMany([ ...htmlElements or oo.UI.ButtonWidgets ])
	 */

	// -----------------------------------------------------------------------------
	// #WIKI TEXT SYNTAX
	// -----------------------------------------------------------------------------
	// Wikipedia Classes NameSpace
	var Wiki = {};
	/**
	 * @since 2.6.0
	 */
	Wiki.Text = class extends String {
		static options = {}
		constructor(rawWikitext, options, C) {
			super(rawWikitext)
			this.C = Object.assign({}, C || {});
			this.options = Object.assign({}, this.constructor.options, options || {});
		}
		/**
		 * https://www.mediawiki.org/wiki/ResourceLoader/Core_modules#mediawiki.api
		 * https://doc.wikimedia.org/mediawiki-core/master/js/#!/api/mw.Api
		 * https://www.mediawiki.org/wiki/Special:ApiSandbox#action=parse&text=%7B%7BProject:Sandbox%7D%7D&contentmodel=wikitext
		 * @example render().done((data) => …)
		 * @returns {mw.API}
		 */
		render() {
			// Get rendered wikitext with no miscelanious things
			var api = new mw.Api();
			return api.post({
				action: `parse`,
				format: `json`,
				text: this,
				contentmodel: `wikitext`,
				prop: {
					langlinks: false,
					categories: false,
					categorieshtml: false,
					links: false,
					parsetree: false,
					properties: false
				},
				preview: true
			})
		}
	};
	/** Wikipedia's Template markup as string in the form of {{}}
	 * https://en.wikipedia.org/wiki/Wikipedia:Anatomy_of_a_template
	 * @return {TemplateTag} */
	Wiki.Text.Tag = class {

		static IATE = InvalidArgumentTypeError;
		/** Basic Tokens */
		static B = "{{";
		static D = "|";
		static E = "}}";

		/**
		 * @param {String} name - Tag name e.g. diff, oldid2
		 * @param {params} params - Params of the template: {diff|param1|paramX|….}
		 */
		constructor(name, params) {
			if (new Object(name).constructor !== String) {
				throw new this.constructor.IATE(
					`Invalid arg: string expected`
				);
			}

			if (!(params instanceof Array)) {
				throw new this.constructor.IATE(
					"params have to be an array"
				);
			}

			let isParamString;
			// Replace non-string by "" (empty) string
			params = params.map((param) => {
				isParamString = new Object(param) instanceof String;
				return isParamString ? param.toString() : "";
			});

			this.name = name;
			this.params = params;
		}
		valueOf() {
			return this.toString();
		}
		toString() {
			// Create `{{name|param0|param1|paramN}}`
			let B = this.constructor.B; // Tag token
			let D = this.constructor.D; // Tag token
			let E = this.constructor.E; // Tag token
			let val = "";
			val += B;
			val += this.name;
			for (var param of this.params) {
				if (param) val += D + param;
			}
			val += E;
			return val;
		}
	};
	/**
	 * A container for Rows. Renders them into a string via toStirng()
	 * @summary Wikipedia table wikitext wrapper
	 */
	Wiki.Text.Table = class extends String {
		static IATE = InvalidArgumentTypeError;
		constructor({ cssClasses, rows }, options) {
			super();

			this.options = Object.assign(
				{
					caption: `Diffs`,
				},
				options || {}
			);

			if (!(rows instanceof Array)) {
				throw new this.constructor.IATE("rows have to be an array");
			}
			this.cssClasses = cssClasses || ``;
			this.rows = rows;
		}

		valueOf() {
			return this.toString();
		}
		toString() {
			let rowsStr = this.rows.join("\r\n");
			let classAttr = this.cssClasses ? `class="${this.cssClasses}"` : ``;
			return `{|${classAttr}\n|+${this.options.caption}\n${rowsStr}\n|}`;
		}
	};
	Wiki.Text.Table.Row = class extends String {
		constructor({ arr, value }, options, C) {
			if (value) {
				throw new Error(`Provide array instead`);
			}
			let rows = arr.join(`||`);

			super(`|-\n|${rows}`);
			this.C = C || {};
		}
	};
	Wiki.Text.Table.Header = class extends String {
		constructor({ arr, value }, options, C) {
			if (value) {
				throw new Error(`Provide array instead`);
			}
			let rows = arr.join(`!!`);

			super(`!${rows}`);
			this.C = C || {};
		}
	};
	Wiki.Text.Table.Def = class extends String {
		constructor(value) {
			if (new Object(value).value != null) {
				value = obj.value
			}
			super(`${value}`);
		}
	};

	// -----------------------------------------------------------------------------
	// #Wikidate
	// -----------------------------------------------------------------------------
	// @summary I convert Wikidate into Date and help to format it
	Wiki.Date = class extends Date {
		constructor(dateStr) {
			let wdate = dateStr.split(`, `);
			super(wdate.slice(1).concat(wdate[0]).join(`,`));
			wdate = null;
		}

		// Default
		static dateFormat = {
			dateStyle: `medium`
			, timeStyle: "short"
			, hour12: false
		};
		// @para {object} dateFormat -  Format object, see MDN: Intl/DateTimeFormat
		format(dateFormat) {
			return Intl.DateTimeFormat(undefined, dateFormat || this.constructor.dateFormat).format(this);
		}

	}

	// -----------------------------------------------------------------------------
	// #REVISIONS ENTRIES WRAPPER
	// -----------------------------------------------------------------------------
	/**
	  * @summary Container for elements of Entry class 
	  * @class
	  */
	Wiki.Revisions = class extends Array {
		static IATE = InvalidArgumentTypeError;
		/**
		 * @param {Array<Wiki.Entry>} entries
		 * @param {HTMLElement} parentEl
		 * @param {Object} options
		 * @param {Object} C
		 */
		constructor(entries, parentEl, options, C) {
			super();
			// Context
			this.C = Object.assign({}, C || {});
			this.options = Object.assign({}, options || {});
			this.parentEl = parentEl;
			this.el = parentEl;

			if (entries instanceof Array) {
				// throw new this.constructor.IATE(`Array is expected`);
				// Sieve only Entry-based instances
				this.init(entries);
			}
		}


		/**
		 * @summary Clean up checkboxes left by previous script run
		 * @description Use after revisions.fromEl() call
		 * @param {HTMLElement} rootElement 
		 * @returns {Revisions}
		 */
		static checkboxesCleanUp(rootElement) {
			// Clean up previously created checkboxes
			if (rootElement.querySelector(`input[name="select-diff"]`)) {
				$(rootElement).find(`input[name="select-diff"]`).parent().remove();
			}
			return this
		} // checkboxesCleanUp end
		/**
		 * Helper to map HTMLElement children of revisions into Entries
		 * @param {HTMLElement} rawRevisions - An element whose children are going to be wrapped by Entry
		 * @param {Object} opt - Options for Revisions
		 * @param {Object} C   - Context for Revisions
		 * @param {Wiki.Revisions.Entry} Entry - Entry constructor
		 * @param {Object} Eopt - For Entry    - Options for Entry
		 * @param {Object} EC - Wiki UI native checkbox widget
		 * @returns Revisions
		 */
		static fromEl(rawRevisions, opt, C, Entry, Eopt, EC) {
			if (!(
				rawRevisions
				&& rawRevisions.constructor == Array
				&& rawRevisions.length > 0
			)) {
				throw this.IATE(`${Wiki.HH.NAME}: fromEl() expects an array with elements`);
			}

			if (rawRevisions[0].constructor != HTMLLIElement) {
				throw this.IATE(`${Wiki.HH.NAME}: fromEl() expects an array of li elements`);
			}

			EC = Object.assign({ CheckboxInputWidget: OO.ui.CheckboxInputWidget }, EC || {});

			let entries = rawRevisions.map((el) => new Entry(el, Eopt, EC));
			// Invoking this(…) make this portable
			return new this(entries, rawRevisions, opt, C);
		}

		init(entries) {
			for (let i = 0; i < entries.length; i++) {
				const entry = entries[i];
				if (entry instanceof this.constructor.Entry) {
					this[i] = entry;
					entry.parent = this;
				}
			}
		}

		// Return array of checked entries
		checked() {
			let checked = [];
			for (let i = 0; i < this.length; i++) {
				if (this[i].isChecked()) {
					checked.push(this[i]);
				}
			}

			// BUG: This uncessarily registered new controls listeners if called via
			// built-in Array methods
			return new this.constructor(checked, this.parentEl, this.options, this.C);
		}
	};
	// A single revision entry line container
	Wiki.Revisions.Entry = class extends Object {
		static IATE = InvalidArgumentTypeError;
		constructor(el, options, C) {
			super();
			this.C = Object.assign({}, C || {});
			if (!(el instanceof HTMLLIElement)) {
				throw new this.constructor.IATE(`<li> element expected`);
			}
			this.el = el;
			this.init(el);
		}

		init(el) {
			// Revision link
			let href = el.querySelector(`.mw-changeslist-links > span:nth-child(2) > a`);
			if (href == null) {
				console.warn(`${Wiki.HH.NAME}: Entry()..init(): history 'prev' link isn't found, falling back to default values`);
				this.title = "";
				this.diff = "";
				this.oldid = "";
			} else {
				// TODO: BUG ON MAIN PAGE
				let urlParams = new URL(href).searchParams;
				this.title = urlParams.get(`title`);
				this.diff = urlParams.get(`amp;diff`) || urlParams.get(`diff`);
				this.oldid = urlParams.get(`amp;oldid`) || urlParams.get(`oldid`);
			}

			// Date
			let date = el.querySelector(`li > a`);
			if (date && date.textContent) {
				this.date = new Wiki.Date(date.textContent);
			}

			this.user = el.querySelector("bdi") && (el.querySelector("bdi").textContent ?? "");
			let comment = el.querySelector(".comment") ?? "";

			// Strip comments from backslash
			if (comment && comment.textContent) {
				this.comment = el
					.querySelector(".comment")
					.textContent.replace(/[\(\→]/g, "");
			} else {
				this.comment = ``;
			}
		}

		/**
		 * Insert a given el element before entry's first element
		 * @param {HTMLElement} el - element to be inserted before the first child
		 */
		insertBefore(el) {
			this.el.insertBefore(el, this.el.firstChild);
		}
	};

	/**
	 * @summary Container for elements of EntryCB class
	 * @class
	 * @since 2.6.0
	 */
	Wiki.Revisions2 = class extends Wiki.Revisions {
		/**
		 * @param {Array<Wiki.Revisions2.EntryCB>} entries 
		 * @param {HTMLElement} parentEl
		 * @param {Object} options
		 * @param {Object} C
		 */
		constructor(entries, parentEl, options, C) {
			super(entries, parentEl, options, C);
			this.i = 0;
		}
		init(entries) {
			/** @property {Boolean} - Whether any checkbox is checked*/
			this.checkboxes = [];
			this.checkboxes.parent = this;
			this.checkboxes.lastClicked = [];
			for (let i = 0; i < entries.length; i++) {
				const entry = entries[i];
				if (entry instanceof this.constructor.Entry) {
					this[i] = entry;
					// entry.parent = this;
					entry.parent = this;
					entry.checkbox.parent = this.checkboxes;
					this.checkboxes.push(entry.checkbox);
				}
			}
		}
		isAnyChecked() {
			return this.some(entry => entry.checkbox.isSelected())
		}
		checked() {
			return this.filter(entry => entry.isChecked());
		}
	};
	/**
	 * The Entry extended with a checkboxk
	 * @class
	 * @since 2.6.0
	 */
	Wiki.Revisions2.EntryCB = class extends Wiki.Revisions.Entry {
		constructor(el, options, C) {
			super(el, options, C);
			if (this.C.CheckboxInputWidget == null) {
				throw new this.constructor.IATE(`CheckboxInputWidget is missing`);
			}
			// The value is expected to be assigned by external entity
			this.parent
			this.init(el);
			this.initCheckBox();
		}

		initCheckBox() {
			this.checkbox = new this.C.CheckboxInputWidget({
				name: `select-diff`,
				value: this.el.getAttribute(`data-mw-revid`),
				selected: false,
			});
			this.checkbox.$element[0].style.width = `15px`;
			this.checkbox.$element[0].style.height = `15px`;
			this.checkbox.$element.mouseleave(function(e) {
				if (e.buttons === 1) {
					this.setSelected(!this.isSelected());
				}
			}.bind(this.checkbox));
			this.insertBefore(this.checkbox.$element[0]);
		}

		/**
		 * @returns {Boolean} - True if checked
		 */
		isChecked() {
			return this.checkbox.isSelected();
		}
	};

	Wiki.Contributions = class extends Wiki.Revisions2 { };
	Wiki.Contributions.EntryCB = class extends Wiki.Revisions2.EntryCB {
		static IATE = InvalidArgumentTypeError;
		static UserName = mw.config.get(`wgRelevantUserName`);

		constructor(el, options, C) {
			super(el, options, C);
			if (!(el instanceof HTMLLIElement)) {
				throw new this.constructor.IATE(`<li> element expected`);
			}
			let context = {}; // The context here stands for imported object
			this.C = Object.assign(context, C || {});
			this.options = Object.assign({}, options || {});
			this.el = el;
			this.init(el);
		}
		init(el) {
			// Revision links
			let diffEl = el.querySelector(`a.mw-changeslist-diff`) || el.querySelector(`a.mw-changeslist-history`);
			if (diffEl == null) {
				throw new Error(`${Wiki.HH.NAME}: can't find diff element on collaboration page.`);
			}
			let href = diffEl.href;

			if (href == null) {
				throw new Error(`${Wiki.HH.NAME}: Entry()..init(): history 'prev' link isn't found, falling back to default values`)
				this.title = "";
				this.diff = "";
			} else {
				let urlParams = new URL(href).searchParams;
				this.title = urlParams.get(`title`);
				this.diff = this.el.dataset["mwRevid"];
			}
			this.oldid = `prev`;

			this.user = this.constructor.UserName;
			// this.user = mw.config.get(`wgRelevantUserName`);

			// Date
			let date = el.querySelector(`li > a`);
			if (date && date.textContent) {
				el.querySelector(`li > a`).textContent;
				this.date = new Wiki.Date(date.textContent);
			} else {
				this.date = new Wiki.Date(date.textContent);
			}
			this.comment = ``;
			let commentEl = this.el.querySelector(`.comment`);
			if (commentEl) {
				this.comment = commentEl.textContent.replace(/[\(\→]/g, "")

			}
		}
	};


	Wiki.Toolbar = class extends Map {
		static IATE = InvalidArgumentTypeError;
		static config = {
			id: `toolbar-default`
		}
		static buttons = {
			[`info`]: {
				type: `Popup`,
				disabled: true,
				title: `Click buttons on the right`,
				label: `COPY AS`,
				icon: `doubleChevronEnd`,
			},
			[`as.diffs`]: {
				title: `Copy selected as {{diff|…}} wikitext`,
				id: `as.diffs`,
				label: `{{diff}}`,
				icon: `code`,
				template: `{{tqb|\n%\n}}`
			},
			[`as.table`]: {
				title: `Copy selected as table wikitext`,
				id: `as.table`,
				label: `<Table/>`,
				icon: `table`,
				template: ``
			},
			[`as.links`]: {
				title: `Copy selected as raw [1]..[n] links (can be pasted into summary)`,
				id: `as.links`,
				label: `Links`,
				icon: `wikiText`,
				template: ``
			},
		};

		static notice = {
			type: 'info',
			label: 'Nothing to preview. Select checkboxes!',
			title: 'Info',
			inline: true
		}
		/**
		 *
		 * @param {HTMLElement} toolbarEl - Container
		 * @param {Array<Object>} buttons - Arrays of buttons widgets. See add() for supported ones
		 * @param {Object} options -
		 * @param {Object} C - Context
		 */
		constructor(buttons, options, C) {
			super();
			// Options.
			this.arguments = arguments;
			this.arguments[1] = Object.assign({}, options || this.constructor.config);
			this.arguments[2] = Object.assign({}, OO.ui, C || {});

			// Toolbar widget
			this.buttonsGroup = new this.arguments[2].ButtonGroupWidget({ id: this.arguments[1].id });
			this.$element = this.buttonsGroup.$element;
			this.$element.css(`z-index`, 2);
			if (buttons) {
				this.addMany(buttons);
			}
		}

		/**
		 * @typedef  {Object} OO.ui.ButtonWidget -
		 * @property {string} id -
		 * @method addItems
		 */

		/**
		 * Add every button to the group, associate buttons with IDs
		 * @example new Toolbar();
		 * @param {HTMLElement | OO.ui.ButtonGroupWidget | OO.ui.PopupButtonWidget} el
		 * @returns {Wiki.Toolbar}
		 */
		add(el) {
			if (el == null) {
				throw new this.constructor.IATE(`first argument is expected`);
			}
			switch (el.constructor) {
				case HTMLElement:
					this.buttonsGroup.$element[0].appendChild(el);
					el.id && this.set(el.id, el);
					break;
				case this.arguments[2].ButtonWidget:
				case this.arguments[2].PopupButtonWidget:
					el.$element[0].id && this.set(el.$element[0].id, el);
					this.buttonsGroup.addItems([el]);
					break;
					break;
				default:
					console.warn(`toolbar.add(e): unknown e.constructor.`)
			}

			return this;
		}
		/**
		 *
		 * @param {Array<HTMLElement | OO.ui.ButtonGroupWidget>} elements
		 * @returns
		 */
		addMany(elements) {
			for (let i = 0; i < elements.length; i++) {
				this.add(elements[i]);
			}
			return this;
		}

		toArray() {
			return Array.from(this.values())
		}
	};


	/**
	 * The HistoryHelper main class used as nameSpace.
	 * It binds provided UI elements (toolbar/revisions) and binds
	 * Pointer (mouse) and Keyboard strokes to actionsM
	 * (e.g. copy revisions to clipboard)
	 */
	Wiki.HH = class extends Object {
		static NAME = `HistoryHelper`;
		static IATE = InvalidArgumentTypeError;

		// TODO: Deprecate in favor of preview copy text field
		static shortcuts = {
			[`ctrl+alt+d`]: `revisions.as.diffs.to.clipboard`,
			[`ctrl+alt+c`]: `revisions.as.links.to.clipboard`
		}
		static options = {
			fetchLimit: 64
		}
		/**
		 * Overview of basic HistoryHelper workflows
		 * ##Clipboard workflow
		 * revisions.keyboard -> revisionsTo…(revisions) -> clipboard.copy()
		 * buttons.pointer.click  -> entries.to.markup -> clipboard.copy()
		 * buttons.pointer.hover  -> buttons.popup.showPreview(revisions.as.XYZ)
		 * ##UX workflow
		 * buttons.popup.pointer -> preview.modify()
		 * revisions.pointer -> entries.select
		 * revisions.checkboxes.pointer + keyboard.shift -> entries.select
		 * @param {Wiki.Toolbar}    revisions - Data (revisions container)
		 * @param {Wiki.Revisions}  toolbar   - Input (butttons panel)
		 * @param {ClipboardBuffer} clipboard - Output (clipboard buffer)
		 * @param {Object} options - Configuration object
		 * @param {Object} options.shortcuts - Shortcuts to Action map
		 * @param {Object} C           - Namespace for default class constructors
		 * @param {Object} C.Revisions - Revisions entries container constructor
		 * @param {Object} C.Toolbar   - 
		 * @param {Object} C.Clipboard -
		 * @param {Object} C.Text      - WikiText renderer 
		 * used to build output strings
		 */
		constructor(toolbar, revisions, clipboard, options, C) {
			super();
			this.C = {};
			this.C.Revisions = Wiki.Revisions;
			this.C.Toolbar = Wiki.Toolbar; // Containers
			this.C.Clipboard = ClipboardBuffer;
			this.C.Text = Wiki.Text;
			this.C = Object.assign(this.C, (C || {}));

			this.options = Object.assign({}, this.constructor.options, options || {});

			if (!(toolbar instanceof this.C.Toolbar)) throw new this.constructor.IATE(`toolbar   instance of Toolbar   is expected`);
			if (!(revisions instanceof this.C.Revisions)) throw new this.constructor.IATE(`revisions instance of Revisions is expected`);
			if (!(clipboard instanceof this.C.Clipboard)) throw new this.constructor.IATE(`clipboard instance of Clipboard is expected`);

			this.toolbar = toolbar;
			this.revisions = revisions;
			this.clipboard = clipboard;

			//#ACTIONS MAP
			//------------------------------------------
			// These are intended to be invoked on some user
			// actions such as click or keypress
			// These callbacks are called from multiple places
			this[`revisions.as.diffs.to.clipboard`] = function() {
				this.clipboard.copy(this.constructor.revisionsToDIFFS(this.revisions.checked(), undefined, options))
			}.bind(this);
			this[`revisions.as.table.to.clipboard`] = function() {
				this.clipboard.copy(this.constructor.revisionsToTABLE(this.revisions.checked()))
			}.bind(this);
			this[`revisions.as.links.to.clipboard`] = function() {
				this.clipboard.copy(this.constructor.revisionsToLINKS(this.revisions.checked()))
			}.bind(this);

			this[`revisions.as.diffs.rendered`] = function(cb) {
				let selected = this.revisions.checked().slice(0, this.options.fetchLimit);
				let wikitext = this.constructor.revisionsToDIFFS(selected, undefined, options);
				wikitext
					? new this.C.Text(wikitext).render().done(cb)
					: cb({});
			}.bind(this);
			this[`revisions.as.table.rendered`] = function(cb) {
				let selected = this.revisions.checked().slice(0, this.options.fetchLimit);
				let wikitext = this.constructor.revisionsToTABLE(selected);
				wikitext
					? new this.C.Text(wikitext).render().done(cb)
					: cb({});
			}.bind(this);
			this[`revisions.as.links.rendered`] = function(cb) {
				let selected = this.revisions.checked().slice(0, this.options.fetchLimit);
				let wikitext = this.constructor.revisionsToLINKS(selected);
				wikitext
					? new this.C.Text(wikitext).render().done(cb)
					: cb({});
			}.bind(this);

			this.buttons = this.toolbar.toArray();
			this.initButtons();
			this.initRevisionsListeners();
			this.initRevisionsSpecialListneners();
		} // CONSTRUCTOR END

		// Associate button clicks with actions
		initButtons() {
			//#POINTER CONTROL - BUTTONS
			//------------------------------------------
			for (let button of this.buttons) {
				button.$element.click(this[`revisions.${button.elementId}.to.clipboard`]);

				// Show preview of the selected entries
				button.$element.mouseenter(function(button, e) {
					// Hide all popups
					for (let nextButton of this.buttons) {
						nextButton.popup.toggle(false);
					}
					button.popup.toggle(true);
					let d0 = button.popup.$lable.isVisible();
					if (this.revisions.isAnyChecked()) {
						button.popup.$lable.toggle(false);
						setTimeout(() => {
							this[`revisions.${button.elementId}.rendered`]((response) => {
								if (response.parse) {
									button.popup.html(`${response.parse.text[`*`]}`)
								} else {
									button.popup.html(``);
								}
							});
						}, 300);
					} else {
						button.popup.$lable.toggle(true);
					}

				}.bind(this, button)); // bindEventEnd
			}
		}

		// Associate keyboard hotkeys with actions
		// Only works when pointer is in area of a revisions list element
		initRevisionsListeners() {
			//#KEYBOARD CONTROL
			//------------------------------------------
			if (this.options.shortcuts) {
				const ctrlKey = `ctrl`;
				const shiftKey = `shift`;
				const altKey = `alt`;
				this.revisions.parentEl.tabIndex = 1;
				$(this.revisions.parentEl).bind(`keyup`, (e) => {
					let pressedKeys = ``;
					pressedKeys += e.ctrlKey ? ctrlKey + `+` : ``;
					pressedKeys += e.shiftKey ? shiftKey + `+` : ``;
					pressedKeys += e.altKey ? altKey + `+` : ``;
					pressedKeys += e.key;
					// Match the keystroke into a an action declared above
					let action = this[this.options.shortcuts[pressedKeys]];
					if (action) action();

				});
			}
		}
		// Associate keyboard + pointer hotkeys behavior
		// Allows selecting checkboxes range by using shift + checkbox click
		initRevisionsSpecialListneners() {
			//#CHECKBOXES CONTROL
			//------------------------------------------
			this.revisions.checkboxes.lastClicked[1] = this.revisions.checkboxes[0];
			$(this.revisions.el).click((e) => {
				// Clear up preview data
				for (let button of this.buttons) {
					button.popup.html(``);
				}
				// We need to focuse only on widget's span element
				let focusedCheckbox;
				if (e.target instanceof HTMLInputElement) {
					focusedCheckbox = e.target.parentElement;
				}
				if (e.target instanceof HTMLSpanElement
					&& /oo-ui-checkboxInputWidget/.test(e.target.className)) {
					focusedCheckbox = e.target;
				}
				/**@type Array<CheckboxInputWidgets> */
				let checkboxes = this.revisions.checkboxes;

				if (checkboxes.lastClicked[1] !== focusedCheckbox) {
					checkboxes.lastClicked[0] = checkboxes.lastClicked[1];
					checkboxes.lastClicked[1] = focusedCheckbox;
				}

				if (
					e.shiftKey &&
					checkboxes.lastClicked[0] &&
					checkboxes.lastClicked[1]
				) {

					let from = checkboxes.findIndex((widget) => {
						return checkboxes.lastClicked[0] === widget.$element[0]
					});
					let to = checkboxes.findIndex((widget) => {
						return checkboxes.lastClicked[1] === widget.$element[0]
					});
					if (from > to) {
						let mid = to;
						to = from;
						from = mid;
					}
					from++;
					for (; from < to; from++) {
						checkboxes[from].setSelected(!checkboxes[from].isSelected())
					}
				}
			});
		}

		// Words to higlight
		static highlights = /competen(t|cy)|IR|bitch|illiterate|fuck(er)?|asshole(ery)?|troll|idiot|dumbass|stupid|blank|subhuman|autis[tm]|(edit)? warring|inept/g;

		/** Convert revisions entries into a Wikitext (diffs)
		 * @since 2.6.0
		 * @param {Wiki.Revisions} revisions - Array that contains Entry instances
		 * @param {Wiki.Text.Tag} Tag 
		 * @returns {String}
		 */
		static revisionsToDIFFS(revisions, Tag, config) {
			Tag = Tag || Wiki.Text.Tag;
			if (!(revisions)) { throw new this.IATE(`Revisions are missing`) }
			if (!revisions.length) { return `` }
			let entry, tag, wikitext = ``;
			let comment;
			let users = new Set();
			// Walk over every entry
			for (let i = 0; i < revisions.length; i++) {
				entry = revisions[i];


				if (entry && new Object(entry.user).constructor == String) {

					if (entry.user !== mw.config.get(`wgUserName`)) {
						users.add(entry.user);
					}
				}
				if (entry && new Object(entry.date).constructor == Wiki.Date) {
					entry.date = entry.date.format();
				}

				tag = new Tag(`diff`, [
					entry.diff,
					entry.oldid,
					entry.date,
				]);

				// Highlight specified by config words and phrases
				// Highlight incivility
				comment = entry.comment.replace(this.highlights, `{{highlight|$&}}`);
				let highlights = config && new Object(config.highlights);
				if (highlights
					&& highlights.constructor === Array
					&& highlights.length) {
					for (let i = 0, reg; i < highlights.length; i++) {
						reg = highlights[i];
						comment = comment.replace(reg, `{{highlight|$&}}`);
					}
				}
				comment = comment ? `- ''«${comment}»''` : ``;
				wikitext += `${tag.toString()} ${comment}<br/>\n`;
			}

			if (users.size) {
				wikitext += ':';
				wikitext += new Tag(`re`, Array.from(users));
			}
			return wikitext


		}

		/** Convert revisions entries into a Wikitext (Special:Diff/… links)
		 * @since 2.6.0
		 * @param {Wiki.Revisions} revisions - Array that contains Entry instances
		 * @returns {String}
		 */
		static revisionsToLINKS(revisions) {
			if (!(revisions)) { throw new this.IATE(`Revisions are missing`) }
			if (!revisions.length) { return `No revisions selected` }
			let entry, wikitext = ``;
			for (let i = 0; i < revisions.length; i++) {
				entry = revisions[i];

				if (entry && new Object(entry.date).constructor == Wiki.Date) {
					entry.date = entry.date.format();
				}
				// Omit prev
				let diff = entry.oldid;
				if(diff == "prev") {
					diff = entry.diff
				}
				wikitext += `[[Special:Diff/${diff}|[${entry.date}]]]`
			}
			return wikitext


		}
		/** Convert revisions entries into a Wikitext (tables )
		 * @since 2.6.0
		 * @param {Wiki.Revisions} revisions - Array that contains Entry instances
		 * @param {Wiki.Text.Tag} Tag 
		 * @param {Wiki.Text.Table} Table
		 * @returns {String}
		 */
		static revisionsToTABLE(revisions, Tag, Table) {
			if (!(revisions)) { throw new this.IATE(`Revisions are missing`) }
			if (!revisions.length) { return `` }

			Table = Table || Wiki.Text.Table;
			Tag = Tag || Wiki.Text.Tag;

			// Every entry wrapped into a wiki tag
			// Group of tags into table definitions (colums)
			let entry;
			let anchor, anchLink, diff, oldid, user, tags, entries;
			let defintions = [];
			for (let i = 0; i < revisions.length; i++) {
				entry = revisions[i];

				anchLink = `hist-${i}-${entry.diff}`;

				anchor = new Tag(`anchor`, [anchLink]);
				diff = new Tag(`diff`, [entry.oldid, entry.date]);
				oldid = new Tag(`oldid2`, [1, entry.oldid, entry.date]);
				user = new Tag(`u`, [entry.user]);

				tags = [
					anchor + `[[#${anchLink}|${i}]]`,
					diff,
					oldid,
					user,
					entry.comment ? `''${entry.comment}''` : ``
				]
				defintions.push(tags.map(tag => new Table.Def(tag)));

			}
			// Wrap ever column into a row
			// First row is the head
			let columns;
			let rows = [
				new Table.Header({
					arr: [`#`, `DIFF`, `CURRENT`, `USER`, `SUMMARY`],
				})
			];

			for (let i = 0; i < defintions.length; i++) {
				columns = defintions[i];
				rows.push(new Table.Row({ arr: columns }))
			}

			let wikitext = new Table({
				cssClasses: "wikitable sortable",
				rows: rows,
			}).toString();
			return wikitext;



		}
	};

	//#USER CONFIG
	//------------------------------------------
	// Convert legacy (prior  2.6.0) config version into a 2.6.0 
	if (window.HistoryHelper && window.HistoryHelper.shortcuts) {
		let shortcuts = window.HistoryHelper.shortcuts;
		// 1/2 For every shortcut
		for (const key in shortcuts) {
			if (Object.hasOwnProperty.call(shortcuts, key)) {
				const actionName = shortcuts[key];
				// 2/2 if an old action match, replace by a new one
				if (actionName === `copyAsdiffs`) {
					shortcuts[key] = `revisions.as.links.to.clipboard`;
					console.warn(`${Wiki.HH.NAME}: copyAsdiffs action is deprecated after v2.6.0, update your config`)
				}
			}
		}
	}

	let config = Object.assign(
		{}
		// Turn off default shortcuts
		// ,{ shortcuts: Wiki.HH.shortcuts},
		, window.HistoryHelper || {}
	);

	// ---------------------------------------------------------------------------
	// #MAIN
	// ---------------------------------------------------------------------------
	let main = function main() {
		let contribPageRe = /Special:Contributions/
		let isContributionsPage = contribPageRe.test(window.location.href);
		let isHistoryPage = new URL(window.location).searchParams.get("action") == "history";
		if (!(isContributionsPage || isHistoryPage)) {
			return
		}

		// Initialize toolbar & buttons
		let buttons = Object.values(Wiki.Toolbar.buttons).map((data) => {
			let $lable = new OO.ui.MessageWidget(Wiki.Toolbar.notice);
			$lable.$element.css(`min-width`, `478px`)
			let $content = $(`<div></div>`)
			// .append($notice.$element);
			let popup = new OO.ui.PopupWidget({
				width: null,
				head: true,
				label: $lable.$element,
				$content: $content,
				padded: true,
				autoClose: true,
				autoFlip: false
			});
			popup.$element.css(`z-index`, 32);
			popup.$element.css(`min-width`, `330px`);
			popup.$element.css(`min-height`, `127px`);
			popup.$content = $content;
			popup.$lable = $lable;
			popup.html = function(str) {
				return this.$content.html(str)
			}

			let button = new OO.ui.ButtonWidget({ ...data, content: [popup] });
			button.popup = popup;
			return button
		})
		//  New toolbar
		window[Wiki.Toolbar.config.id] && window[Wiki.Toolbar.config.id].remove();
		let toolbar = new Wiki.Toolbar(buttons);
		//  Initialize revisions container

		let pagehistory = document.getElementById(`pagehistory`)
			|| document.querySelector(`#mw-content-text section.mw-pager-body`);
		if (!(pagehistory)) {
			throw new Error(
				`${Wiki.HH.NAME}: can't find revisions html element.
        \n\tThis is probably due to Wikipedia changing its HTML ids.
        \n\tContact the script author for help:
        \n\thttps://en.wikipedia.org/w/index.php?title=User_talk:Alexander_Davronov&action=edit&section=new`
			);
			return
		}
		//  Remove old checkboxes
		Wiki.Revisions2.checkboxesCleanUp(pagehistory);

		let clipboard = new ClipboardBuffer();
		// Article or User history page
		// https://www.mediawiki.org/wiki/Manual:Interface/JavaScript#mw.config
		if (isHistoryPage) {

			let rawRevisions = Array.from(pagehistory.querySelectorAll(`ul > li`));
			let revisions = Wiki.Revisions2.fromEl(
				rawRevisions, {}, {}
				, Wiki.Revisions2.EntryCB
			);

			// Adding tools
			let revCompareForm = document.getElementById(`mw-history-compare`);
			let toolbarContainerTarget =
				revCompareForm
				&& revCompareForm.querySelector(`.mw-history-compareselectedversions`);

			$(toolbarContainerTarget).append(toolbar.$element);
			if (toolbar.$element[0] && !toolbar.$element[0].children.length) {
				throw new Error(`${Wiki.HH.NAME}: Toolbar has no buttons, please fill a bug report!`);
			}

			// Init HistoryHelper controls (button press handlers)
			// over toolbar and revisions
			new Wiki.HH(toolbar, revisions, clipboard, config);
			return
		}
		// User contributions page
		let isViewing = mw.config.get(`wgAction`) === `view`;
		if (isViewing) {
			let rawRevisions = Array.from(pagehistory.querySelectorAll(`ul > li`));
			let revisions = Wiki.Contributions.fromEl(
				rawRevisions, {}, {}
				, Wiki.Contributions.EntryCB
				, { user: mw.config.get(`wgRelevantUserName`) }
			);
			let toolbarContainerTarget = document.getElementById(`mw-content-text`).firstChild;
			toolbar.$element.insertAfter(toolbarContainerTarget);
			new Wiki.HH(toolbar, revisions, clipboard, config);
			return
		}
	}

	mw.loader.using([`oojs-ui.styles.icons-editing-advanced`, `oojs-ui.styles.icons-alerts`], main);


	// From the End comes The Beginning!
	// Something ends, something begins!
});
