import { HomeAssistant } from "../ha-types";
import { html, LitElement } from "../lit-element";
import { IEntityConfig, IAttribute } from "../types";
import { logError } from "../utils";
import styles from "./entity-styles";

interface IMap<T> {
    [key: string]: T
}

interface IAttributeViewData {
    value: string,
    tooltip: string,
    icon?: string,
    label?: string,
    action?: Function,
}

export class GithubEntity extends LitElement {

    private config: IEntityConfig = <any>null;

    private icon: string = "mdi:github";

    private name: string = "";

    private secondaryInfo: string = <any>null;

    private attributesData: IAttributeViewData[] = [];

    private action: Function | undefined;

    private url: string | boolean | undefined;

    /**
     * CSS for the card
     */
    static get styles() {
        return styles;
    }

    static get properties() {
        return {
            icon: { type: String },
            name: { type: String },
            secondaryInfo: { type: String },
            attributesData: { type: Array },
            action: { type: Function },
        };
    }

    set hass(hass: HomeAssistant) {

        if (!this.config) {
            return;
        }

        const entityData = hass.states[this.config.entity];
        if (!entityData) {
            logError("Entity not found: " + this.config.entity);
            return;
        }

        this.name = replaceKeywordsWithData(entityData.attributes, this.config.name) || entityData.attributes["friendly_name"];
        this.icon = this.config.icon || entityData.attributes["icon"];

        if (this.config.secondary_info) {
            this.secondaryInfo = replaceKeywordsWithData(entityData.attributes, this.config.secondary_info) as string;
        }

        const newStats = getAttributesViewData(this.config, entityData.attributes);

        // check to avoid unnecessary re-rendering
        if (JSON.stringify(newStats) != JSON.stringify(this.attributesData)) {
            this.attributesData = newStats;
        }

        // check whether we need to update the action
        if (this.url != this.config.url) {
            this.url = this.config.url;
            this.action = getAction("home", this.url, entityData.attributes);
        }
    }

    setConfig(config: IEntityConfig) {
        const oldConfig = JSON.stringify(this.config);
        const newConfig = JSON.stringify(config);

        if (oldConfig == newConfig) {
            return;
        }

        if (!config.entity) {
            logError("Missing 'entity' property in entity configuration");
            return;
        }

        // we cannot just assign the config because it is immutable and we want to change it
        this.config = JSON.parse(newConfig);

        this.name = config.name || config.entity;
        config.icon && (this.icon = config.icon);
        config.secondary_info && (this.secondaryInfo = config.secondary_info);
    }

    render() {
        return html`
        <div class="entity-row compact-view">
            <div class="icon">
                <ha-icon icon="${this.icon}"></ha-icon>
            </div>
            <div class="name truncate${this.action ? " clickable" : ""}" @click="${this.action}">
                ${this.name}
                ${this.secondaryInfo && html`<div class="secondary">${this.secondaryInfo}</div>`}
            </div>
            ${this.attributesData.map(attributeView)}
        <div>
        `;
    }
}

const attributeView = (attr: IAttributeViewData) => html`
<div class="state${attr.action ? " clickable" : ""}" @click="${attr.action}" title="${attr.tooltip}">
    <ha-icon icon="${attr.icon}" style="color: var(--primary-color)">
    </ha-icon>
    <div>${attr.value}</div>
</div>
`;

const replaceKeywordsWithData = (data: IMap<string>, text?: string) =>
    text && text.replace(/\{([a-z0-9_]+)\}/g, (match, keyword) => data[keyword] !== undefined ? data[keyword] : match);

/**
 * Attribute name to icon map
 */
const nameToIconMap: IMap<string> = {
    "open_issues": "mdi:alert-circle-outline",
    "open_pull_requests": "mdi:source-pull",
    "stargazers": "mdi:star",
    "forks": "mdi:source-fork",
    "latest_release_tag": "mdi:tag-outline",
    "clones": "mdi:download-outline",
    "clones_unique": "mdi:download-outline",
    "views": "mdi:eye",
    "views_unique": "mdi:eye-check",
}

/**
 * Attribute name to url path map
 */
const nameToUrlPathMap: IMap<string> = {
    "open_issues": "issues",
    "open_pull_requests": "pulls",
    "stargazers": "stargazers",
    "forks": "network/members",
    "latest_release_tag": "releases",
    "clones": "graphs/traffic",
    "clones_unique": "graphs/traffic",
    "views": "graphs/traffic",
    "views_unique": "graphs/traffic",
    "home": ""
}

/**
 * Creates action for clickable elements
 */
const getAction = (attributeName: string, url: boolean | string | undefined, data: IMap<string>): Function | undefined => {
    switch (typeof url) {
        case "boolean":
            if (!url) {
                return undefined;
            }

            if (!data["path"]) {
                logError(`Cannot build url - entity path attribute is missing`);
                return undefined;
            }

            if (!nameToUrlPathMap[attributeName] === undefined) {
                logError(`Sorry url cannot be built for "${attributeName}"`);
                return undefined;
            }

            return () => window.open(`https://github.com/${data["path"]}/${nameToUrlPathMap[attributeName]}`);
        case "string":
            return () => window.open(replaceKeywordsWithData(data, url));
        case "undefined":
            // we don't do anything
            break;
        default:
            logError("Unsupported url type: " + typeof url);
    }

    return undefined;
}

/**
 * Gets list of attributes data to render
 */
const getAttributesViewData = (config: IEntityConfig, data: IMap<string>): IAttributeViewData[] =>
    (config.attributes || []).map(a => {
        return {
            value: data[a.name],
            tooltip: attributeNameToTooltip(a.name),
            icon: a.icon || nameToIconMap[a.name],
            label: a.label && replaceKeywordsWithData(data, a.label),
            action: getAction(
                a.name,
                // if attrib url property is missing use the entity-level setting
                a.url !== undefined ? a.url : config.attribute_urls,
                data),
        }
    });

const attributeNameToTooltip = (name: string): string => name.substr(0, 1).toUpperCase() + name.substr(1).replace(/_/g, " ");