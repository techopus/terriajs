import i18next from "i18next";
import { action, computed, observable, runInAction, toJS } from "mobx";
import { createTransformer } from "mobx-utils";
import Clock from "terriajs-cesium/Source/Core/Clock";
import defaultValue from "terriajs-cesium/Source/Core/defaultValue";
import defined from "terriajs-cesium/Source/Core/defined";
import DeveloperError from "terriajs-cesium/Source/Core/DeveloperError";
import CesiumEvent from "terriajs-cesium/Source/Core/Event";
import queryToObject from "terriajs-cesium/Source/Core/queryToObject";
import RuntimeError from "terriajs-cesium/Source/Core/RuntimeError";
import ImagerySplitDirection from "terriajs-cesium/Source/Scene/ImagerySplitDirection";
import URI from "urijs";
import AsyncLoader from "../Core/AsyncLoader";
import Class from "../Core/Class";
import ConsoleAnalytics from "../Core/ConsoleAnalytics";
import CorsProxy from "../Core/CorsProxy";
import filterOutUndefined from "../Core/filterOutUndefined";
import getDereferencedIfExists from "../Core/getDereferencedIfExists";
import GoogleAnalytics from "../Core/GoogleAnalytics";
import instanceOf from "../Core/instanceOf";
import isDefined from "../Core/isDefined";
import JsonValue, {
  isJsonBoolean,
  isJsonNumber,
  isJsonObject,
  isJsonString,
  JsonObject
} from "../Core/Json";
import loadJson5 from "../Core/loadJson5";
import ServerConfig from "../Core/ServerConfig";
import TerriaError from "../Core/TerriaError";
import { getUriWithoutPath } from "../Core/uriHelpers";
import PickedFeatures, {
  featureBelongsToCatalogItem
} from "../Map/PickedFeatures";
import GroupMixin from "../ModelMixins/GroupMixin";
import ReferenceMixin from "../ModelMixins/ReferenceMixin";
import TimeVarying from "../ModelMixins/TimeVarying";
import { HelpContentItem } from "../ReactViewModels/defaultHelpContent";
import { defaultTerms, Term } from "../ReactViewModels/defaultTerms";
import { Notification } from "../ReactViewModels/ViewState";
import { shareConvertNotification } from "../ReactViews/Notification/shareConvertNotification";
import { BaseMapViewModel } from "../ViewModels/BaseMapViewModel";
import TerriaViewer from "../ViewModels/TerriaViewer";
import CameraView from "./CameraView";
import CatalogGroup from "./CatalogGroupNew";
import CatalogMemberFactory from "./CatalogMemberFactory";
import Catalog from "./CatalogNew";
import CommonStrata from "./CommonStrata";
import Feature from "./Feature";
import GlobeOrMap from "./GlobeOrMap";
import InitSource, { isInitOptions, isInitUrl } from "./InitSource";
import Internationalization, {
  I18nStartOptions,
  LanguageConfiguration
} from "./Internationalization";
import MagdaReference, { MagdaReferenceHeaders } from "./MagdaReference";
import MapInteractionMode from "./MapInteractionMode";
import Mappable from "./Mappable";
import { BaseModel } from "./Model";
import openGroup from "./openGroup";
import ShareDataService from "./ShareDataService";
import SplitItemReference from "./SplitItemReference";
import TimelineStack from "./TimelineStack";
import updateModelFromJson from "./updateModelFromJson";
import upsertModelFromJson from "./upsertModelFromJson";
import ViewerMode from "./ViewerMode";
import Workbench from "./Workbench";
// import overrides from "../Overrides/defaults.jsx";

interface ConfigParameters {
  [key: string]: ConfigParameters[keyof ConfigParameters];
  appName?: string;
  supportEmail?: string;
  defaultMaximumShownFeatureInfos?: number;
  regionMappingDefinitionsUrl: string;
  conversionServiceBaseUrl?: string;
  proj4ServiceBaseUrl?: string;
  corsProxyBaseUrl?: string;
  proxyableDomainsUrl?: string;
  serverConfigUrl?: string;
  shareUrl?: string;
  feedbackUrl?: string;
  initFragmentPaths: string[];
  storyEnabled: boolean;
  interceptBrowserPrint?: boolean;
  tabbedCatalog?: boolean;
  useCesiumIonTerrain?: boolean;
  cesiumIonAccessToken?: string;
  hideTerriaLogo?: boolean;
  useCesiumIonBingImagery?: boolean;
  bingMapsKey?: string;
  brandBarElements?: string[];
  disableMyLocation?: boolean;
  experimentalFeatures?: boolean;
  magdaReferenceHeaders?: MagdaReferenceHeaders;
  locationSearchBoundingBox?: number[];
  googleAnalyticsKey?: string;
  rollbarAccessToken?: string;
  globalDisclaimer?: any;
  showWelcomeMessage?: boolean;
  welcomeMessageVideo?: any;
  showInAppGuides?: boolean;
  helpContent?: HelpContentItem[];
  helpContentTerms?: Term[];
  languageConfiguration?: LanguageConfiguration;
  displayOneBrand?: number;
}

interface StartOptions {
  configUrl: string;
  configUrlHeaders?: {
    [key: string]: string;
  };
  applicationUrl?: Location;
  shareDataService?: ShareDataService;
  /**
   * i18nOptions is explicitly a separate option from `languageConfiguration`,
   * as `languageConfiguration` can be serialised, but `i18nOptions` may have
   * some functions that are passed in from a TerriaMap
   *  */
  i18nOptions?: I18nStartOptions;
}

type Analytics = any;

interface TerriaOptions {
  baseUrl?: string;
  analytics?: Analytics;
}

interface ApplyInitDataOptions {
  initData: JsonObject;
  replaceStratum?: boolean;
}

interface HomeCameraInit {
  [key: string]: HomeCameraInit[keyof HomeCameraInit];
  north: number;
  east: number;
  south: number;
  west: number;
}

export default class Terria {
  private models = observable.map<string, BaseModel>();

  readonly baseUrl: string = "build/TerriaJS/";
  readonly notification = new CesiumEvent();
  readonly error = new CesiumEvent();
  readonly tileLoadProgressEvent = new CesiumEvent();
  readonly workbench = new Workbench();
  readonly overlays = new Workbench();
  readonly catalog = new Catalog(this);
  readonly timelineClock = new Clock({ shouldAnimate: false });
  // readonly overrides: any = overrides; // TODO: add options.functionOverrides like in master

  @observable
  readonly mainViewer = new TerriaViewer(
    this,
    computed(() =>
      filterOutUndefined(
        this.overlays.items
          .map(item => (Mappable.is(item) ? item : undefined))
          .concat(
            this.workbench.items.map(item =>
              Mappable.is(item) ? item : undefined
            )
          )
      )
    )
  );

  appName: string = "TerriaJS App";
  supportEmail: string = "support@terria.io";

  /**
   * Gets or sets the {@link this.corsProxy} used to determine if a URL needs to be proxied and to proxy it if necessary.
   * @type {CorsProxy}
   */
  corsProxy: CorsProxy = new CorsProxy();

  /**
   * Gets or sets the instance to which to report Google Analytics-style log events.
   * If a global `ga` function is defined, this defaults to `GoogleAnalytics`.  Otherwise, it defaults
   * to `ConsoleAnalytics`.
   */
  readonly analytics: Analytics;

  /**
   * Gets the stack of layers active on the timeline.
   */
  readonly timelineStack = new TimelineStack(this.timelineClock);

  @observable
  readonly configParameters: ConfigParameters = {
    appName: "TerriaJS App",
    supportEmail: "info@terria.io",
    defaultMaximumShownFeatureInfos: 100,
    regionMappingDefinitionsUrl: "build/TerriaJS/data/regionMapping.json",
    conversionServiceBaseUrl: "convert/",
    proj4ServiceBaseUrl: "proj4/",
    corsProxyBaseUrl: "proxy/",
    proxyableDomainsUrl: "proxyabledomains/",
    serverConfigUrl: "serverconfig/",
    shareUrl: "share",
    feedbackUrl: undefined,
    initFragmentPaths: ["init/"],
    storyEnabled: true,
    interceptBrowserPrint: true,
    tabbedCatalog: false,
    useCesiumIonTerrain: true,
    cesiumIonAccessToken: undefined,
    hideTerriaLogo: false,
    useCesiumIonBingImagery: undefined,
    bingMapsKey: undefined,
    brandBarElements: undefined,
    disableMyLocation: undefined,
    experimentalFeatures: undefined,
    magdaReferenceHeaders: undefined,
    locationSearchBoundingBox: undefined,
    googleAnalyticsKey: undefined,
    rollbarAccessToken: undefined,
    globalDisclaimer: undefined,
    showWelcomeMessage: false,
    welcomeMessageVideo: {
      videoTitle: "Getting started with the map",
      videoUrl: "https://www.youtube.com/embed/FjSxaviSLhc",
      placeholderImage:
        "https://img.youtube.com/vi/FjSxaviSLhc/maxresdefault.jpg"
    },
    showInAppGuides: false,
    helpContent: [],
    helpContentTerms: defaultTerms,
    languageConfiguration: undefined,
    displayOneBrand: 1 // seems to be the default on master
  };

  @observable
  baseMaps: BaseMapViewModel[] = [];

  @observable
  pickedFeatures: PickedFeatures | undefined;

  @observable
  selectedFeature: Feature | undefined;

  @observable
  allowFeatureInfoRequests: boolean = true;

  /**
   * Gets or sets the stack of map interactions modes.  The mode at the top of the stack
   * (highest index) handles click interactions with the map
   */
  @observable
  mapInteractionModeStack: MapInteractionMode[] = [];

  baseMapContrastColor: string = "#ffffff";

  @observable
  readonly userProperties = new Map<string, any>();

  @observable
  readonly initSources: InitSource[] = [];
  private _initSourceLoader = new AsyncLoader(
    this.forceLoadInitSources.bind(this)
  );

  @observable serverConfig: any; // TODO
  @observable shareDataService: ShareDataService | undefined;

  /* Splitter controls */
  @observable showSplitter = false;
  @observable splitPosition = 0.5;
  @observable splitPositionVertical = 0.5;
  @observable terrainSplitDirection: ImagerySplitDirection =
    ImagerySplitDirection.NONE;

  @observable depthTestAgainstTerrainEnabled = false;

  @observable stories: any[] = [];

  // TODO: this is duplicated with properties on ViewState, which is
  //       kind of terrible.
  /**
   * Gets or sets the ID of the catalog member that is currently being
   * previewed.
   */
  @observable previewedItemId: string | undefined;

  /**
   * Base ratio for maximumScreenSpaceError
   * @type {number}
   */
  @observable baseMaximumScreenSpaceError = 2;

  /**
   * Gets or sets whether to use the device's native resolution (sets cesium.viewer.resolutionScale to a ratio of devicePixelRatio)
   * @type {boolean}
   */
  @observable useNativeResolution = false;

  /**
   * Whether we think all references in the catalog have been loaded
   * @type {boolean}
   */
  @observable catalogReferencesLoaded: boolean = false;

  constructor(options: TerriaOptions = {}) {
    if (options.baseUrl) {
      if (options.baseUrl.lastIndexOf("/") !== options.baseUrl.length - 1) {
        this.baseUrl = options.baseUrl + "/";
      } else {
        this.baseUrl = options.baseUrl;
      }
    }

    this.analytics = options.analytics;
    if (!defined(this.analytics)) {
      if (typeof window !== "undefined" && defined((<any>window).ga)) {
        this.analytics = new GoogleAnalytics();
      } else {
        this.analytics = new ConsoleAnalytics();
      }
    }
  }

  @computed
  get currentViewer(): GlobeOrMap {
    return this.mainViewer.currentViewer;
  }

  @computed
  get cesium(): import("./Cesium").default | undefined {
    if (
      isDefined(this.mainViewer) &&
      this.mainViewer.currentViewer.type === "Cesium"
    ) {
      return this.mainViewer.currentViewer as import("./Cesium").default;
    }
  }

  @computed
  get leaflet(): import("./Leaflet").default | undefined {
    if (
      isDefined(this.mainViewer) &&
      this.mainViewer.currentViewer.type === "Leaflet"
    ) {
      return this.mainViewer.currentViewer as import("./Leaflet").default;
    }
  }

  @computed
  get modelIds() {
    return Array.from(this.models.keys());
  }

  getModelById<T extends BaseModel>(type: Class<T>, id: string): T | undefined {
    const model = this.models.get(id);
    if (instanceOf(type, model)) {
      return model;
    }

    // Model does not have the requested type.
    return undefined;
  }

  @action
  addModel(model: BaseModel) {
    if (model.uniqueId === undefined) {
      throw new DeveloperError("A model without a `uniqueId` cannot be added.");
    }

    if (this.models.has(model.uniqueId)) {
      throw new RuntimeError("A model with the specified ID already exists.");
    }

    this.models.set(model.uniqueId, model);
  }

  /**
   * Remove references to a model from Terria.
   */
  @action
  removeModelReferences(model: BaseModel) {
    const pickedFeatures = this.pickedFeatures;
    if (pickedFeatures) {
      // Remove picked features that belong to the catalog item
      pickedFeatures.features.forEach((feature, i) => {
        if (featureBelongsToCatalogItem(<Feature>feature, model)) {
          pickedFeatures?.features.splice(i, 1);
        }
      });
    }
    this.workbench.remove(model);
    if (model.uniqueId) {
      this.models.delete(model.uniqueId);
    }
  }

  setupInitializationUrls(baseUri: uri.URI, config: any) {
    const initializationUrls: string[] = config.initializationUrls || [];
    const initSources = initializationUrls.map(url =>
      generateInitializationUrl(
        baseUri,
        this.configParameters.initFragmentPaths,
        url
      )
    );
    this.initSources.push(...initSources);
  }

  start(options: StartOptions) {
    this.shareDataService = options.shareDataService;

    const baseUri = new URI(options.configUrl).filename("");

    const launchUrlForAnalytics =
      options.applicationUrl?.href || getUriWithoutPath(baseUri);
    return loadJson5(options.configUrl, options.configUrlHeaders)
      .then((config: any) => {
        runInAction(() => {
          // If it's a magda config, we only load magda config and parameters should never be a property on the direct
          // config aspect (it would be under the `terria-config` aspect)
          if (config.aspects) {
            return this.loadMagdaConfig(options.configUrl, config).then(() => {
              Internationalization.initLanguage(
                this.configParameters.languageConfiguration,
                options.i18nOptions
              );
              this.setupInitializationUrls(
                baseUri,
                config.aspects?.["terria-config"]
              );
            });
          }

          // If it's a regular config.json, continue on with parsing remaining init sources
          if (config.parameters) {
            this.updateParameters(config.parameters);
            Internationalization.initLanguage(
              config.parameters.languageConfiguration,
              options.i18nOptions
            );
          }

          this.setupInitializationUrls(baseUri, config);
        });
      })
      .then(() => {
        this.analytics?.start(this.configParameters);
        this.analytics?.logEvent("launch", "url", launchUrlForAnalytics);
        this.serverConfig = new ServerConfig();
        return this.serverConfig.init(this.configParameters.serverConfigUrl);
      })
      .then((serverConfig: any) => {
        return this.initCorsProxy(this.configParameters, serverConfig);
      })
      .then(() => {
        if (this.shareDataService && this.serverConfig.config) {
          this.shareDataService.init(this.serverConfig.config);
        }
        this.loadPersistedMapSettings();
        if (options.applicationUrl) {
          return this.updateApplicationUrl(options.applicationUrl.href);
        }
      });
  }

  loadPersistedMapSettings(): void {
    const persistViewerMode = defaultValue(
      this.configParameters.persistViewerMode,
      true
    );
    const mainViewer = this.mainViewer;
    const viewerMode = this.getLocalProperty("viewermode");
    if (persistViewerMode && defined(viewerMode)) {
      if (viewerMode === "3d" || viewerMode === "3dsmooth") {
        mainViewer.viewerMode = ViewerMode.Cesium;
        mainViewer.viewerOptions.useTerrain = viewerMode === "3d";
      } else if (viewerMode === "2d") {
        mainViewer.viewerMode = ViewerMode.Leaflet;
      } else {
        console.error(
          `Trying to select ViewerMode ${viewerMode} that doesn't exist`
        );
      }
    }
  }

  @action
  updateBaseMaps(baseMaps: BaseMapViewModel[]): void {
    this.baseMaps.push(...baseMaps);
    if (!this.mainViewer.baseMap) {
      this.loadPersistedBaseMap();
    }
  }

  @action
  loadPersistedBaseMap(): void {
    const persistedBaseMapId = this.getLocalProperty("basemap");
    const baseMapSearch = this.baseMaps.find(
      baseMap => baseMap.mappable.uniqueId === persistedBaseMapId
    );
    if (baseMapSearch) {
      this.mainViewer.baseMap = baseMapSearch.mappable;
    } else {
      console.error(
        `Couldn't find a basemap for unique id ${persistedBaseMapId}`
      );
    }
  }

  get isLoadingInitSources(): boolean {
    return this._initSourceLoader.isLoading;
  }

  /**
   * Asynchronously loads init sources
   */
  loadInitSources(): Promise<void> {
    return this._initSourceLoader.load();
  }

  dispose() {
    this._initSourceLoader.dispose();
  }

  updateFromStartData(startData: any) {
    interpretStartData(this, startData);
    return this.loadInitSources();
  }

  updateApplicationUrl(newUrl: string) {
    const uri = new URI(newUrl);
    const hash = uri.fragment();
    const hashProperties = queryToObject(hash);

    return interpretHash(
      this,
      hashProperties,
      this.userProperties,
      new URI(newUrl)
        .filename("")
        .query("")
        .hash("")
    ).then(() => {
      return this.loadInitSources();
    });
  }

  @action
  updateParameters(parameters: ConfigParameters): void {
    Object.keys(parameters).forEach((key: string) => {
      if (this.configParameters.hasOwnProperty(key)) {
        this.configParameters[key] = parameters[key];
      }
    });

    this.appName = defaultValue(this.configParameters.appName, this.appName);
    this.supportEmail = defaultValue(
      this.configParameters.supportEmail,
      this.supportEmail
    );
  }

  protected forceLoadInitSources(): Promise<void> {
    const initSourcePromises = this.initSources.map(initSource => {
      return loadInitSource(initSource).catch(e => {
        this.error.raiseEvent(e);
        return undefined;
      });
    });

    return Promise.all(initSourcePromises).then(initSources => {
      return runInAction(() => {
        const promises = filterOutUndefined(initSources).map(initSource =>
          this.applyInitData({
            initData: initSource
          })
        );
        return Promise.all(promises);
      }).then(() => undefined);
    });
  }

  private loadModelStratum(
    modelId: string,
    stratumId: string,
    allModelStratumData: JsonObject,
    replaceStratum: boolean
  ): Promise<BaseModel> {
    const thisModelStratumData = allModelStratumData[modelId] || {};
    if (!isJsonObject(thisModelStratumData)) {
      throw new TerriaError({
        sender: this,
        title: "Invalid model traits",
        message: "The traits of a model must be a JSON object."
      });
    }

    const cleanStratumData = { ...thisModelStratumData };
    delete cleanStratumData.dereferenced;
    delete cleanStratumData.knownContainerUniqueIds;

    let promise: Promise<void>;

    const containerIds = thisModelStratumData.knownContainerUniqueIds;
    if (Array.isArray(containerIds)) {
      // Groups that contain this item must be loaded before this item.
      const containerPromises = containerIds.map(containerId => {
        if (typeof containerId !== "string") {
          return Promise.resolve(undefined);
        }
        return this.loadModelStratum(
          containerId,
          stratumId,
          allModelStratumData,
          replaceStratum
        ).then(container => {
          const dereferenced = ReferenceMixin.is(container)
            ? container.target
            : container;
          if (GroupMixin.isMixedInto(dereferenced)) {
            return dereferenced.loadMembers();
          }
        });
      });
      promise = Promise.all(containerPromises).then(() => undefined);
    } else {
      promise = Promise.resolve();
    }

    // If this model is a `SplitItemReference` we must load the source item first
    const splitSourceId = cleanStratumData.splitSourceItemId;
    if (
      cleanStratumData.type === SplitItemReference.type &&
      typeof splitSourceId === "string"
    ) {
      promise = promise.then(() =>
        this.loadModelStratum(
          splitSourceId,
          stratumId,
          allModelStratumData,
          replaceStratum
        ).then(() => undefined)
      );
    }

    return promise
      .then(() => {
        const loadedModel = upsertModelFromJson(
          CatalogMemberFactory,
          this,
          "/",
          undefined,
          stratumId,
          {
            ...cleanStratumData,
            id: modelId
          },
          replaceStratum
        );

        if (Array.isArray(containerIds)) {
          containerIds.forEach(containerId => {
            if (
              typeof containerId === "string" &&
              loadedModel.knownContainerUniqueIds.indexOf(containerId) < 0
            ) {
              loadedModel.knownContainerUniqueIds.push(containerId);
            }
          });
        }

        // If we're replacing the stratum and the existing model is already
        // dereferenced, we need to replace the dereferenced stratum, too,
        // even if there's no trace of it in the load data.
        let dereferenced = thisModelStratumData.dereferenced;
        if (
          replaceStratum &&
          dereferenced === undefined &&
          ReferenceMixin.is(loadedModel) &&
          loadedModel.target !== undefined
        ) {
          dereferenced = {};
        }

        if (ReferenceMixin.is(loadedModel)) {
          return loadedModel.loadReference().then(() => {
            if (isDefined(loadedModel.target)) {
              updateModelFromJson(
                loadedModel.target,
                stratumId,
                dereferenced || {},
                replaceStratum
              );
            }
            return loadedModel;
          });
        } else if (dereferenced) {
          throw new TerriaError({
            sender: this,
            title: "Model cannot be dereferenced",
            message:
              "The stratum has a `dereferenced` property, but the model cannot be dereferenced."
          });
        }

        return loadedModel;
      })
      .then(loadedModel => {
        const dereferenced = getDereferencedIfExists(loadedModel);
        if (GroupMixin.isMixedInto(dereferenced)) {
          return openGroup(dereferenced, dereferenced.isOpen).then(
            () => loadedModel
          );
        } else {
          return loadedModel;
        }
      });
  }

  @action
  applyInitData({
    initData,
    replaceStratum = false
  }: ApplyInitDataOptions): Promise<void> {
    initData = toJS(initData);
    const stratumId =
      typeof initData.stratum === "string"
        ? initData.stratum
        : CommonStrata.definition;

    // Extract the list of CORS-ready domains.
    if (Array.isArray(initData.corsDomains)) {
      this.corsProxy.corsDomains.push(...(<string[]>initData.corsDomains));
    }

    if (initData.catalog !== undefined) {
      this.catalog.group.addMembersFromJson(stratumId, initData.catalog);
    }

    if (Array.isArray(initData.stories)) {
      this.stories = initData.stories;
    }

    if (isJsonString(initData.viewerMode)) {
      switch (initData.viewerMode.toLowerCase()) {
        case "3d".toLowerCase():
          this.mainViewer.viewerOptions.useTerrain = true;
          this.mainViewer.viewerMode = ViewerMode.Cesium;
          break;
        case "3dSmooth".toLowerCase():
          this.mainViewer.viewerOptions.useTerrain = false;
          this.mainViewer.viewerMode = ViewerMode.Cesium;
          break;
        case "2d".toLowerCase():
          this.mainViewer.viewerMode = ViewerMode.Leaflet;
          break;
      }
    }

    if (isJsonObject(initData.homeCamera)) {
      this.loadHomeCamera(initData.homeCamera);
    }

    if (isJsonObject(initData.initialCamera)) {
      const initialCamera = CameraView.fromJson(initData.initialCamera);
      this.currentViewer.zoomTo(initialCamera, 2.0);
    }

    if (isJsonBoolean(initData.showSplitter)) {
      this.showSplitter = initData.showSplitter;
    }

    if (isJsonNumber(initData.splitPosition)) {
      this.splitPosition = initData.splitPosition;
    }

    // Copy but don't yet load the workbench.
    const workbench = Array.isArray(initData.workbench)
      ? initData.workbench.slice()
      : [];

    const timeline = Array.isArray(initData.timeline)
      ? initData.timeline.slice()
      : [];

    // Load the models
    let promise: Promise<void>;

    const models = initData.models;
    if (isJsonObject(models)) {
      promise = Promise.all(
        Object.keys(models).map(modelId => {
          return this.loadModelStratum(
            modelId,
            stratumId,
            models,
            replaceStratum
          ).catch(e => {
            // TODO: deal with shared models that can't be loaded because, e.g. because they are private
            console.log(e);
            return Promise.resolve();
          });
        })
      ).then(() => undefined);
    } else {
      promise = Promise.resolve();
    }

    return promise.then(() => {
      return runInAction(() => {
        if (isJsonString(initData.previewedItemId)) {
          this.previewedItemId = initData.previewedItemId;
        }

        const promises: Promise<void>[] = [];

        // Set the new contents of the workbench.
        const newItems = filterOutUndefined(
          workbench.map(modelId => {
            if (typeof modelId !== "string") {
              throw new TerriaError({
                sender: this,
                title: "Invalid model ID in workbench",
                message: "A model ID in the workbench list is not a string."
              });
            }

            return this.getModelById(BaseModel, modelId);
          })
        );

        this.workbench.items = newItems;

        // TODO: the timelineStack should be populated from the `timeline` property,
        // not from the workbench.
        this.timelineStack.items = this.workbench.items
          .filter(item => {
            return item.uniqueId && timeline.indexOf(item.uniqueId) >= 0;
            // && TODO: what is a good way to test if an item is of type TimeVarying.
          })
          .map(item => <TimeVarying>item);

        // Load the items on the workbench
        for (let model of newItems) {
          if (ReferenceMixin.is(model)) {
            promises.push(model.loadReference());
            model = model.target || model;
          }

          if (Mappable.is(model)) {
            promises.push(model.loadMapItems());
          }
        }

        return Promise.all(promises).then(() => undefined);
      });
    });
  }

  @action
  loadHomeCamera(homeCameraInit: JsonObject | HomeCameraInit) {
    this.mainViewer.homeCamera = CameraView.fromJson(homeCameraInit);
  }

  async loadMagdaConfig(configUrl: string, config: any) {
    const magdaRoot = new URI(configUrl)
      .path("")
      .query("")
      .toString();

    const aspects = config.aspects;
    const configParams =
      aspects["terria-config"] && aspects["terria-config"].parameters;

    configParams.initializationUrls =
      aspects["terria-config"] && aspects["terria-config"].initializationUrls;
    if (configParams) {
      this.updateParameters(configParams);
    }

    const initObj = aspects["terria-init"];
    if (isJsonObject(initObj)) {
      await this.applyInitData({
        initData: initObj as any
      });
    }

    if (aspects.group && aspects.group.members) {
      const id = config.id;

      let existingReference = this.getModelById(MagdaReference, id);
      if (existingReference === undefined) {
        existingReference = new MagdaReference(id, this);
        this.addModel(existingReference);
      }

      const reference = existingReference;

      reference.setTrait(CommonStrata.definition, "url", magdaRoot);
      reference.setTrait(CommonStrata.definition, "recordId", config.id);
      reference.setTrait(CommonStrata.definition, "magdaRecord", config);
      await reference.loadReference().then(() => {
        if (reference.target instanceof CatalogGroup) {
          runInAction(() => {
            this.catalog.group = <CatalogGroup>reference.target;
          });
        }
      });
    }
  }

  initCorsProxy(config: any, serverConfig: any): Promise<void> {
    // All the "proxyableDomains" bits here are due to a pre-serverConfig mechanism for whitelisting domains.
    // We should deprecate it.s

    // If a URL was specified in the config parameters to get the proxyable domains from, get them from that
    var pdu = this.configParameters.proxyableDomainsUrl;
    const proxyableDomainsPromise: Promise<JsonValue | void> = pdu
      ? loadJson5(pdu)
      : Promise.resolve();
    return proxyableDomainsPromise.then((proxyableDomains: any | void) => {
      if (proxyableDomains) {
        // format of proxyableDomains JSON file slightly differs from serverConfig format.
        proxyableDomains.allowProxyFor =
          proxyableDomains.allowProxyFor || proxyableDomains.proxyableDomains;
      }

      // If there isn't anything there, check the server config
      if (typeof serverConfig === "object") {
        serverConfig = serverConfig.config; // if server config is unavailable, this remains undefined.
      }

      this.corsProxy.init(
        proxyableDomains || serverConfig,
        this.configParameters.corsProxyBaseUrl,
        config.proxyDomains // fall back to local config
      );
    });
  }

  getUserProperty(key: string) {
    return undefined;
  }

  getLocalProperty(key: string): string | boolean | null {
    try {
      if (!defined(window.localStorage)) {
        return null;
      }
    } catch (e) {
      // SecurityError can arise if 3rd party cookies are blocked in Chrome and we're served in an iFrame
      return null;
    }
    var v = window.localStorage.getItem(this.appName + "." + key);
    if (v === "true") {
      return true;
    } else if (v === "false") {
      return false;
    }
    return v;
  }

  setLocalProperty(key: string, value: string | boolean): boolean {
    try {
      if (!defined(window.localStorage)) {
        return false;
      }
    } catch (e) {
      return false;
    }
    window.localStorage.setItem(this.appName + "." + key, value.toString());
    return true;
  }
}

function generateInitializationUrl(
  baseUri: uri.URI,
  initFragmentPaths: string[],
  url: string
): InitSource {
  if (url.toLowerCase().substring(url.length - 5) !== ".json") {
    return {
      options: initFragmentPaths.map(fragmentPath => {
        return {
          initUrl: URI.joinPaths(fragmentPath, url + ".json")
            .absoluteTo(baseUri)
            .toString()
        };
      })
    };
  }
  return {
    initUrl: new URI(url).absoluteTo(baseUri).toString()
  };
}

const loadInitSource = createTransformer(
  (initSource: InitSource): Promise<JsonObject | undefined> => {
    let promise: Promise<JsonValue | undefined>;

    if (isInitUrl(initSource)) {
      promise = loadJson5(initSource.initUrl);
    } else if (isInitOptions(initSource)) {
      promise = initSource.options.reduce((previousOptionPromise, option) => {
        return previousOptionPromise
          .then(json => {
            if (json === undefined) {
              return loadInitSource(option);
            }
            return json;
          })
          .catch(_ => {
            return loadInitSource(option);
          });
      }, Promise.resolve<JsonObject | undefined>(undefined));
    } else {
      promise = Promise.resolve(initSource.data);
    }

    return promise.then(jsonValue => {
      if (isJsonObject(jsonValue)) {
        return jsonValue;
      }
      return undefined;
    });
  }
);

function interpretHash(
  terria: Terria,
  hashProperties: any,
  userProperties: Map<string, any>,
  baseUri: uri.URI
) {
  // Resolve #share=xyz with the share data service.
  const promise =
    hashProperties.share !== undefined && terria.shareDataService !== undefined
      ? terria.shareDataService.resolveData(hashProperties.share)
      : Promise.resolve({});

  return promise.then((shareProps: any) => {
    runInAction(() => {
      Object.keys(hashProperties).forEach(function(property) {
        const propertyValue = hashProperties[property];
        if (property === "clean") {
          terria.initSources.splice(0, terria.initSources.length);
        } else if (property === "start") {
          // a share link that hasn't been shortened: JSON embedded in URL (only works for small quantities of JSON)
          const startData = JSON.parse(propertyValue);
          interpretStartData(terria, startData);
        } else if (defined(propertyValue) && propertyValue.length > 0) {
          userProperties.set(property, propertyValue);
        } else {
          const initSourceFile = generateInitializationUrl(
            baseUri,
            terria.configParameters.initFragmentPaths,
            property
          );
          terria.initSources.push(initSourceFile);
        }
      });

      if (shareProps) {
        if (shareProps.converted) {
          terria.notification.raiseEvent({
            title: i18next.t("share.convertNotificationTitle"),
            message: shareConvertNotification(shareProps)
          } as Notification);
        }
        interpretStartData(terria, shareProps);
      }
    });
  });
}

function interpretStartData(terria: Terria, startData: any) {
  // TODO: version check, filtering, etc.

  if (startData.initSources) {
    terria.initSources.push(
      ...startData.initSources.map((initSource: any) => {
        return {
          data: initSource
        };
      })
    );
  }

  // if (defined(startData.version) && startData.version !== latestStartVersion) {
  //   adjustForBackwardCompatibility(startData);
  // }

  // if (defined(terria.filterStartDataCallback)) {
  //   startData = terria.filterStartDataCallback(startData) || startData;
  // }

  // // Include any initSources specified in the URL.
  // if (defined(startData.initSources)) {
  //   for (var i = 0; i < startData.initSources.length; ++i) {
  //     var initSource = startData.initSources[i];
  //     // avoid loading terria.json twice
  //     if (
  //       temporaryInitSources.indexOf(initSource) < 0 &&
  //       !initFragmentExists(temporaryInitSources, initSource)
  //     ) {
  //       temporaryInitSources.push(initSource);
  //       // Only add external files to the application's list of init sources.
  //       if (
  //         typeof initSource === "string" &&
  //         persistentInitSources.indexOf(initSource) < 0
  //       ) {
  //         persistentInitSources.push(initSource);
  //       }
  //     }
  //   }
  // }
}
