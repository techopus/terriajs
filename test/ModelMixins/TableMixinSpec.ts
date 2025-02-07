import { runInAction } from "mobx";
import CustomDataSource from "terriajs-cesium/Source/DataSources/CustomDataSource";
import { getMakiIcon } from "../../lib/Map/Icons/Maki/MakiIcons";
import { ImageryParts } from "../../lib/ModelMixins/MappableMixin";
import CsvCatalogItem from "../../lib/Models/Catalog/CatalogItems/CsvCatalogItem";
import CommonStrata from "../../lib/Models/Definition/CommonStrata";
import createStratumInstance from "../../lib/Models/Definition/createStratumInstance";
import updateModelFromJson from "../../lib/Models/Definition/updateModelFromJson";
import Terria from "../../lib/Models/Terria";
import TableColorStyleTraits from "../../lib/Traits/TraitsClasses/TableColorStyleTraits";
import TableOutlineStyleTraits, {
  BinOutlineSymbolTraits,
  EnumOutlineSymbolTraits
} from "../../lib/Traits/TraitsClasses/TableOutlineStyleTraits";
import TablePointStyleTraits, {
  BinPointSymbolTraits,
  EnumPointSymbolTraits
} from "../../lib/Traits/TraitsClasses/TablePointStyleTraits";
import TableStyleTraits from "../../lib/Traits/TraitsClasses/TableStyleTraits";
import TableTimeStyleTraits from "../../lib/Traits/TraitsClasses/TableTimeStyleTraits";

const LatLonValCsv = require("raw-loader!../../wwwroot/test/csv/lat_lon_val.csv");
const LatLonEnumCsv = require("raw-loader!../../wwwroot/test/csv/lat_lon_enum.csv");
const LatLonValCsvDuplicate = require("raw-loader!../../wwwroot/test/csv/lat_lon_val_with_duplicate_row.csv");
const LatLonEnumDateIdCsv = require("raw-loader!../../wwwroot/test/csv/lat_lon_enum_date_id.csv");
const LatLonEnumDateIdWithRegionCsv = require("raw-loader!../../wwwroot/test/csv/lat_lon_enum_date_id_with_regions.csv");
const LgaWithDisambigCsv = require("raw-loader!../../wwwroot/test/csv/lga_state_disambig.csv");
const ParkingSensorDataCsv = require("raw-loader!../../wwwroot/test/csv/parking-sensor-data.csv");
const LegendDecimalPlacesCsv = require("raw-loader!../../wwwroot/test/csv/legend-decimal-places.csv");
const BadDatesCsv = require("raw-loader!../../wwwroot/test/csv/bad-dates.csv");
const regionMapping = JSON.stringify(
  require("../../wwwroot/data/regionMapping.json")
);
const additionalRegionMapping = JSON.stringify(
  require("../../wwwroot/test/regionMapping/additionalRegion.json")
);
const regionIdsSte = JSON.stringify(
  require("../../wwwroot/data/regionids/region_map-STE_2016_AUST_STE_NAME16.json")
);
const regionIdsLgaName = JSON.stringify(
  require("../../wwwroot/data/regionids/region_map-FID_LGA_2011_AUST_LGA_NAME11.json")
);
const regionIdsLgaCode = JSON.stringify(
  require("../../wwwroot/data/regionids/region_map-FID_LGA_2015_AUST_LGA_CODE15.json")
);
const regionIdsLgaNameStates = JSON.stringify(
  require("../../wwwroot/data/regionids/region_map-FID_LGA_2011_AUST_STE_NAME11.json")
);

describe("TableMixin", function() {
  let item: CsvCatalogItem;
  let terria: Terria;

  beforeEach(function() {
    terria = new Terria({
      baseUrl: "./"
    });
    item = new CsvCatalogItem("test", terria, undefined);

    jasmine.Ajax.install();
    jasmine.Ajax.stubRequest(
      "build/TerriaJS/data/regionMapping.json"
    ).andReturn({ responseText: regionMapping });

    jasmine.Ajax.stubRequest(
      "build/TerriaJS/data/regionids/region_map-STE_2016_AUST_STE_NAME16.json"
    ).andReturn({ responseText: regionIdsSte });

    jasmine.Ajax.stubRequest(
      "build/TerriaJS/data/regionids/region_map-FID_LGA_2011_AUST_LGA_NAME11.json"
    ).andReturn({ responseText: regionIdsLgaName });

    jasmine.Ajax.stubRequest(
      "build/TerriaJS/data/regionids/region_map-FID_LGA_2015_AUST_LGA_CODE15.json"
    ).andReturn({ responseText: regionIdsLgaCode });

    jasmine.Ajax.stubRequest(
      "build/TerriaJS/data/regionids/region_map-FID_LGA_2011_AUST_STE_NAME11.json"
    ).andReturn({ responseText: regionIdsLgaNameStates });
  });

  afterEach(function() {
    jasmine.Ajax.uninstall();
  });

  describe("when the table has time, lat/lon and id columns", function() {
    let dataSource: CustomDataSource;
    beforeEach(async function() {
      item.setTrait(CommonStrata.user, "csvString", LatLonEnumDateIdCsv);
      await item.loadMapItems();
      dataSource = <CustomDataSource>item.mapItems[0];
      expect(dataSource instanceof CustomDataSource).toBe(true);
    });

    it("creates one entity per id", async function() {
      expect(item.activeTableStyle.rowGroups.length).toBe(4);
      if (dataSource instanceof CustomDataSource) {
        expect(dataSource.entities.values.length).toBe(4);
      }
    });

    it("sets showInChartPanel to false - as is mappable", async function() {
      expect(item.showInChartPanel).toBeFalsy();
    });

    it("sets showInChartPanel to true - when lat/lon is disabled", async function() {
      updateModelFromJson(item, CommonStrata.definition, {
        columns: [
          { name: "lat", type: "scalar" },
          { name: "lon", type: "scalar" }
        ]
      });
      expect(item.showInChartPanel).toBeTruthy();
    });

    it("doesn't show regions - even if empty region column is detected", () => {});

    it("calculates rectangle", async function() {
      expect(item.rectangle.north).toEqual(-20);
      expect(item.rectangle.south).toEqual(-37);
      expect(item.rectangle.east).toEqual(155);
      expect(item.rectangle.west).toEqual(115);
    });

    describe("the entities", function() {
      it("has availability defined over the correct span", function() {
        expect(
          dataSource.entities.values.map(e => e.availability?.start.toString())
        ).toEqual([
          "2015-08-01T00:00:00Z",
          "2015-08-01T00:00:00Z",
          "2015-08-02T00:00:00Z",
          "2015-08-03T00:00:00Z"
        ]);
        expect(
          dataSource.entities.values.map(e => e.availability?.stop.toString())
        ).toEqual([
          "2015-08-07T06:00:00Z",
          "2015-08-07T00:00:00Z",
          "2015-08-02T23:59:59Z",
          "2015-08-05T00:00:00Z"
        ]);
      });
    });

    describe("when timeColumn is `null`", function() {
      it("returns an empty `discreteTimes`", async function() {
        expect(item.discreteTimes?.length).toBe(6);
        item.defaultStyle.time.setTrait(CommonStrata.user, "timeColumn", null);
        expect(item.discreteTimes).toBe(undefined);
      });

      it("creates entities for all times", async function() {
        item.defaultStyle.time.setTrait(CommonStrata.user, "timeColumn", null);
        await item.loadMapItems();
        const mapItem = item.mapItems[0];
        expect(mapItem instanceof CustomDataSource).toBe(true);
        if (mapItem instanceof CustomDataSource) {
          expect(mapItem.entities.values.length).toBe(13);
        }
      });
    });
  });

  // Note this is identical to "when the table has time, lat/lon and id columns" EXCEPT
  // - one additional spec - "doesn't show regions - even if empty region column is detected"
  // - "sets showInChartPanel to true - when lat/lon is disabled" is replaced by "shows regions when lat/lon is disabled"
  describe("when the table has time, lat/lon, id columns AND regions", function() {
    let dataSource: CustomDataSource;
    beforeEach(async function() {
      item.setTrait(
        CommonStrata.user,
        "csvString",
        LatLonEnumDateIdWithRegionCsv
      );
      await item.loadMapItems();
      dataSource = <CustomDataSource>item.mapItems[0];
      expect(dataSource instanceof CustomDataSource).toBe(true);
    });

    it("creates one entity per id", async function() {
      expect(item.activeTableStyle.rowGroups.length).toBe(4);
      if (dataSource instanceof CustomDataSource) {
        expect(dataSource.entities.values.length).toBe(4);
      }
    });

    it("sets showInChartPanel to false - as is mappable", async function() {
      expect(item.showInChartPanel).toBeFalsy();
    });

    it("shows regions when lat/lon is disabled", async function() {
      updateModelFromJson(item, CommonStrata.definition, {
        columns: [
          { name: "lat", type: "scalar" },
          { name: "lon", type: "scalar" }
        ]
      });
      expect(item.showInChartPanel).toBeFalsy();
      expect(item.showingRegions).toBeTruthy();
      expect(
        item.activeTableStyle.regionColumn?.valuesAsRegions.uniqueRegionIds
          .length
      ).toBe(3);
    });

    it("doesn't show regions - as more points are detected than unique regions", () => {
      expect(item.showingRegions).toBeFalsy();
    });

    it("calculates rectangle", async function() {
      expect(item.rectangle.north).toEqual(-20);
      expect(item.rectangle.south).toEqual(-37);
      expect(item.rectangle.east).toEqual(155);
      expect(item.rectangle.west).toEqual(115);
    });

    describe("the entities", function() {
      it("has availability defined over the correct span", function() {
        expect(
          dataSource.entities.values.map(e => e.availability?.start.toString())
        ).toEqual([
          "2015-08-01T00:00:00Z",
          "2015-08-01T00:00:00Z",
          "2015-08-02T00:00:00Z",
          "2015-08-03T00:00:00Z"
        ]);
        expect(
          dataSource.entities.values.map(e => e.availability?.stop.toString())
        ).toEqual([
          "2015-08-07T06:00:00Z",
          "2015-08-07T00:00:00Z",
          "2015-08-02T23:59:59Z",
          "2015-08-05T00:00:00Z"
        ]);
      });
    });

    describe("when timeColumn is `null`", function() {
      it("returns an empty `discreteTimes`", async function() {
        expect(item.discreteTimes?.length).toBe(6);
        item.defaultStyle.time.setTrait(CommonStrata.user, "timeColumn", null);
        expect(item.discreteTimes).toBe(undefined);
      });

      it("creates entities for all times", async function() {
        item.defaultStyle.time.setTrait(CommonStrata.user, "timeColumn", null);
        await item.loadMapItems();
        const mapItem = item.mapItems[0];
        expect(mapItem instanceof CustomDataSource).toBe(true);
        if (mapItem instanceof CustomDataSource) {
          expect(mapItem.entities.values.length).toBe(13);
        }
      });
    });
  });

  describe("when the table has lat/lon columns but no time & id columns", function() {
    it("creates one entity per row", async function() {
      runInAction(() =>
        item.setTrait(CommonStrata.user, "csvString", LatLonValCsv)
      );

      await item.loadMapItems();
      const mapItem = item.mapItems[0];
      expect(mapItem instanceof CustomDataSource).toBe(true);
      if (mapItem instanceof CustomDataSource) {
        expect(mapItem.entities.values.length).toBe(5);
      }
    });

    it("removes duplicate rows when requested", async function() {
      runInAction(() => {
        item.setTrait(CommonStrata.user, "csvString", LatLonValCsvDuplicate);
        item.setTrait(CommonStrata.user, "removeDuplicateRows", true);
      });

      await item.loadMapItems();
      const mapItem = item.mapItems[0];
      expect(mapItem instanceof CustomDataSource).toBe(true);
      if (mapItem instanceof CustomDataSource) {
        expect(mapItem.entities.values.length).toBe(5);

        const duplicateValue = 7;
        let occurrences = 0;
        for (let entity of mapItem.entities.values) {
          const val = entity.properties?.value.getValue();
          if (val === duplicateValue) {
            occurrences++;
          }
        }
        expect(occurrences).toBe(1);
      }
    });

    it("has the correct property names", async function() {
      runInAction(() =>
        item.setTrait(CommonStrata.user, "csvString", LatLonValCsv)
      );
      await item.loadMapItems();
      const dataSource = item.mapItems[0] as CustomDataSource;
      const propertyNames =
        dataSource.entities.values[0].properties?.propertyNames;
      expect(propertyNames).toEqual(["lat", "lon", "value"]);
    });
  });

  describe("when the time column has bad datetimes in it", function() {
    it("ignores them gracefully", async function() {
      runInAction(() =>
        item.setTrait(CommonStrata.user, "csvString", BadDatesCsv)
      );

      await item.loadMapItems();
      const mapItem = item.mapItems[0];
      expect(mapItem instanceof CustomDataSource).toBe(true);
      if (mapItem instanceof CustomDataSource) {
        expect(mapItem.entities.values.length).toBe(3);
      }
    });
  });

  describe("when the table has time-series points with intervals", function() {
    let dataSource: CustomDataSource;
    beforeEach(async function() {
      item.setTrait(CommonStrata.user, "csvString", ParkingSensorDataCsv);
      await item.loadMapItems();
      dataSource = <CustomDataSource>item.mapItems[0];
      expect(dataSource instanceof CustomDataSource).toBe(true);
    });

    it("creates one entity per id", async function() {
      expect(dataSource.entities.values.length).toBe(21);
    });

    it("creates correct intervals", async function() {
      expect(item.activeTableStyle.timeIntervals?.length).toBe(21);
      expect(item.disableDateTimeSelector).toBeFalsy();
      expect(
        item.activeTableStyle.timeIntervals?.map(t => [
          t?.start.toString(),
          t?.stop.toString()
        ])
      ).toEqual([
        ["2021-06-25T10:39:02Z", "2021-06-26T10:39:01Z"],
        ["2021-06-25T10:26:45Z", "2021-06-26T10:26:44Z"],
        ["2021-06-25T10:18:01Z", "2021-06-26T10:18:00Z"],
        ["2021-06-25T09:53:52Z", "2021-06-26T09:53:51Z"],
        ["2021-06-25T09:51:32Z", "2021-06-26T09:51:31Z"],
        ["2021-06-25T09:47:06Z", "2021-06-26T09:47:05Z"],
        ["2021-06-25T09:19:21Z", "2021-06-26T09:19:20Z"],
        ["2021-06-25T09:14:36Z", "2021-06-26T09:14:35Z"],
        ["2021-06-25T09:06:47Z", "2021-06-26T09:06:46Z"],
        ["2021-06-25T09:01:32Z", "2021-06-26T09:01:31Z"],
        ["2021-06-25T08:25:09Z", "2021-06-26T08:25:08Z"],
        ["2021-06-25T07:22:15Z", "2021-06-26T07:22:14Z"],
        ["2021-06-25T06:10:52Z", "2021-06-26T06:10:51Z"],
        ["2021-06-25T04:39:45Z", "2021-06-26T04:39:44Z"],
        ["2021-06-25T03:46:13Z", "2021-06-26T03:46:12Z"],
        ["2021-06-25T00:29:26Z", "2021-06-26T00:29:25Z"],
        ["2021-06-25T00:27:23Z", "2021-06-26T00:27:22Z"],
        ["2021-06-24T14:39:42Z", "2021-06-25T14:39:41Z"],
        ["2021-06-15T02:50:37Z", "2021-06-16T02:50:36Z"],
        ["2021-05-12T00:52:56Z", "2021-05-13T00:52:55Z"],
        ["2021-05-04T03:55:39Z", "2021-05-05T03:55:38Z"]
      ]);
    });

    it("creates correct intervals if spreadStartTime", async function() {
      runInAction(() =>
        item.setTrait(
          CommonStrata.user,
          "defaultStyle",
          createStratumInstance(TableStyleTraits, {
            time: createStratumInstance(TableTimeStyleTraits, {
              spreadStartTime: true
            })
          })
        )
      );
      expect(item.disableDateTimeSelector).toBeFalsy();
      expect(item.activeTableStyle.timeIntervals?.length).toBe(21);
      expect(
        item.activeTableStyle.timeIntervals?.map(t => [
          t?.start.toString(),
          t?.stop.toString()
        ])
      ).toEqual([
        ["2021-05-04T03:55:39Z", "2021-06-26T10:39:01Z"],
        ["2021-05-04T03:55:39Z", "2021-06-26T10:26:44Z"],
        ["2021-05-04T03:55:39Z", "2021-06-26T10:18:00Z"],
        ["2021-05-04T03:55:39Z", "2021-06-26T09:53:51Z"],
        ["2021-05-04T03:55:39Z", "2021-06-26T09:51:31Z"],
        ["2021-05-04T03:55:39Z", "2021-06-26T09:47:05Z"],
        ["2021-05-04T03:55:39Z", "2021-06-26T09:19:20Z"],
        ["2021-05-04T03:55:39Z", "2021-06-26T09:14:35Z"],
        ["2021-05-04T03:55:39Z", "2021-06-26T09:06:46Z"],
        ["2021-05-04T03:55:39Z", "2021-06-26T09:01:31Z"],
        ["2021-05-04T03:55:39Z", "2021-06-26T08:25:08Z"],
        ["2021-05-04T03:55:39Z", "2021-06-26T07:22:14Z"],
        ["2021-05-04T03:55:39Z", "2021-06-26T06:10:51Z"],
        ["2021-05-04T03:55:39Z", "2021-06-26T04:39:44Z"],
        ["2021-05-04T03:55:39Z", "2021-06-26T03:46:12Z"],
        ["2021-05-04T03:55:39Z", "2021-06-26T00:29:25Z"],
        ["2021-05-04T03:55:39Z", "2021-06-26T00:27:22Z"],
        ["2021-05-04T03:55:39Z", "2021-06-25T14:39:41Z"],
        ["2021-05-04T03:55:39Z", "2021-06-16T02:50:36Z"],
        ["2021-05-04T03:55:39Z", "2021-05-13T00:52:55Z"],
        ["2021-05-04T03:55:39Z", "2021-05-05T03:55:38Z"]
      ]);
    });

    it("creates correct intervals if spreadStartTime and spreadFinishTime", async function() {
      runInAction(() =>
        item.setTrait(
          CommonStrata.user,
          "defaultStyle",
          createStratumInstance(TableStyleTraits, {
            time: createStratumInstance(TableTimeStyleTraits, {
              spreadStartTime: true,
              spreadFinishTime: true
            })
          })
        )
      );
      expect(item.disableDateTimeSelector).toBeTruthy();
      expect(item.activeTableStyle.timeIntervals?.length).toBe(21);
      expect(item.activeTableStyle.moreThanOneTimeInterval).toBe(false);
    });

    it("creates correct intervals if spreadFinishTime", async function() {
      runInAction(() =>
        item.setTrait(
          CommonStrata.user,
          "defaultStyle",
          createStratumInstance(TableStyleTraits, {
            time: createStratumInstance(TableTimeStyleTraits, {
              spreadFinishTime: true
            })
          })
        )
      );
      expect(item.activeTableStyle.timeIntervals?.length).toBe(21);
      expect(
        item.activeTableStyle.timeIntervals?.map(t => [
          t?.start.toString(),
          t?.stop.toString()
        ])
      ).toEqual([
        ["2021-06-25T10:39:02Z", "2021-06-26T10:39:01Z"],
        ["2021-06-25T10:26:45Z", "2021-06-26T10:39:01Z"],
        ["2021-06-25T10:18:01Z", "2021-06-26T10:39:01Z"],
        ["2021-06-25T09:53:52Z", "2021-06-26T10:39:01Z"],
        ["2021-06-25T09:51:32Z", "2021-06-26T10:39:01Z"],
        ["2021-06-25T09:47:06Z", "2021-06-26T10:39:01Z"],
        ["2021-06-25T09:19:21Z", "2021-06-26T10:39:01Z"],
        ["2021-06-25T09:14:36Z", "2021-06-26T10:39:01Z"],
        ["2021-06-25T09:06:47Z", "2021-06-26T10:39:01Z"],
        ["2021-06-25T09:01:32Z", "2021-06-26T10:39:01Z"],
        ["2021-06-25T08:25:09Z", "2021-06-26T10:39:01Z"],
        ["2021-06-25T07:22:15Z", "2021-06-26T10:39:01Z"],
        ["2021-06-25T06:10:52Z", "2021-06-26T10:39:01Z"],
        ["2021-06-25T04:39:45Z", "2021-06-26T10:39:01Z"],
        ["2021-06-25T03:46:13Z", "2021-06-26T10:39:01Z"],
        ["2021-06-25T00:29:26Z", "2021-06-26T10:39:01Z"],
        ["2021-06-25T00:27:23Z", "2021-06-26T10:39:01Z"],
        ["2021-06-24T14:39:42Z", "2021-06-26T10:39:01Z"],
        ["2021-06-15T02:50:37Z", "2021-06-26T10:39:01Z"],
        ["2021-05-12T00:52:56Z", "2021-06-26T10:39:01Z"],
        ["2021-05-04T03:55:39Z", "2021-06-26T10:39:01Z"]
      ]);
    });

    it("creates disable time dimension by default for this dataset", async function() {
      expect(item.timeDisableDimension).toBeDefined();
    });

    it("doesn't disable time dimension if `showDisableTimeOption = false`", async function() {
      runInAction(() =>
        item.setTrait(CommonStrata.user, "showDisableTimeOption", false)
      );

      expect(item.timeDisableDimension).toBeUndefined();
    });

    it("doesn't disable time dimension by default for another dataset", async function() {
      runInAction(() => {
        item.setTrait(CommonStrata.user, "csvString", LatLonEnumDateIdCsv);
      });

      await item.loadMapItems();
      expect(item.timeDisableDimension).toBeUndefined();
    });

    it("creates disable time dimension for another dataset if `showDisableTimeOption = true`", async function() {
      runInAction(() => {
        item.setTrait(CommonStrata.user, "csvString", LatLonEnumDateIdCsv);
        item.setTrait(CommonStrata.user, "showDisableTimeOption", true);
      });

      await item.loadMapItems();
      expect(item.timeDisableDimension).toBeDefined();
    });
  });

  describe("when the table has a few styles", function() {
    it("creates all styleDimensions", async function() {
      runInAction(() => {
        item.setTrait(CommonStrata.user, "csvString", LatLonEnumDateIdCsv);
      });

      await item.loadMapItems();

      expect(item.styleDimensions?.options?.length).toBe(4);
      expect(item.styleDimensions?.options?.[2].id).toBe("value");
      expect(item.styleDimensions?.options?.[2].name).toBe("Value");
    });

    it("creates all styleDimensions - with disable style", async function() {
      runInAction(() => {
        item.setTrait(CommonStrata.user, "csvString", LatLonEnumDateIdCsv);
        item.setTrait(CommonStrata.user, "showDisableStyleOption", true);
      });

      await item.loadMapItems();

      expect(item.styleDimensions?.options?.length).toBe(4);
      expect(item.styleDimensions?.allowUndefined).toBeTruthy();
      expect(item.styleDimensions?.undefinedLabel).toBe(
        "models.tableData.styleDisabledLabel"
      );
    });

    it("uses TableColumnTraits for style title", async function() {
      runInAction(() => {
        item.setTrait(CommonStrata.user, "csvString", LatLonEnumDateIdCsv);
        updateModelFromJson(item, CommonStrata.definition, {
          columns: [{ name: "value", title: "Some Title" }]
        });
      });

      await item.loadMapItems();

      expect(item.styleDimensions?.options?.[2].id).toBe("value");
      expect(item.styleDimensions?.options?.[2].name).toBe("Some Title");
    });

    it("uses TableStyleTraits for style title", async function() {
      runInAction(() => {
        item.setTrait(CommonStrata.user, "csvString", LatLonEnumDateIdCsv);
        updateModelFromJson(item, CommonStrata.definition, {
          columns: [{ name: "value", title: "Some Title" }],
          styles: [{ id: "value", title: "Some Style Title" }]
        });
      });

      await item.loadMapItems();

      expect(item.styleDimensions?.options?.[2].id).toBe("value");
      expect(item.styleDimensions?.options?.[2].name).toBe("Some Style Title");
    });

    it("loads regionProviderLists on loadMapItems", async function() {
      item.setTrait(CommonStrata.user, "csvString", LatLonEnumDateIdCsv);

      await item.loadMetadata();

      expect(item.regionProviderLists).toBeUndefined();

      await item.loadMapItems();

      expect(item.regionProviderLists?.[0]?.regionProviders.length).toBe(114);
    });

    it("loads regionProviderLists on loadMapItems - with multiple regionMappingDefinitionsUrl", async function() {
      // We add "additionalRegion.json" - which defines two region types
      // - "SOME_OTHER_REGION" - which is just another region type
      // - "SOME_OVERRIDDEN_REGION" - which will override "LGA_NAME_2011" in "build/TerriaJS/data/regionMapping.json"
      jasmine.Ajax.stubRequest("additionalRegion.json").andReturn({
        responseText: additionalRegionMapping
      });

      terria.updateParameters({
        regionMappingDefinitionsUrls: [
          "additionalRegion.json",
          "build/TerriaJS/data/regionMapping.json"
        ]
      });

      item.setTrait(CommonStrata.user, "csvString", LgaWithDisambigCsv);

      await item.loadMetadata();

      expect(item.regionProviderLists).toBeUndefined();

      await item.loadMapItems();

      expect(item.regionProviderLists?.length).toBe(2);

      expect(item.regionProviderLists?.[0]?.regionProviders.length).toBe(2);
      expect(item.regionProviderLists?.[1]?.regionProviders.length).toBe(114);

      // Item region provider should match from "additionalRegion.json" (as it comes before "build/TerriaJS/data/regionMapping.json")
      expect(item.activeTableStyle.regionColumn?.regionType?.description).toBe(
        "Local Government Areas 2011 by name (ABS) !!!! OVERRIDDEN"
      );
    });

    it("loads regionProviderLists on loadMapItems - will use regionMappingDefinitionsUrl instead of regionMappingDefinitionsUrls", async function() {
      // We add "additionalRegion.json" - which defines two region types
      // - "SOME_OTHER_REGION" - which is just another region type
      // - "SOME_OVERRIDDEN_REGION" - which will override "LGA_NAME_2011" in "build/TerriaJS/data/regionMapping.json"
      jasmine.Ajax.stubRequest("additionalRegion.json").andReturn({
        responseText: additionalRegionMapping
      });

      terria.updateParameters({
        regionMappingDefinitionsUrl: "build/TerriaJS/data/regionMapping.json",
        regionMappingDefinitionsUrls: [
          "additionalRegion.json",
          "build/TerriaJS/data/regionMapping.json"
        ]
      });

      item.setTrait(CommonStrata.user, "csvString", LgaWithDisambigCsv);

      await item.loadMetadata();

      expect(item.regionProviderLists).toBeUndefined();

      await item.loadMapItems();

      expect(item.regionProviderLists?.length).toBe(1);

      expect(item.regionProviderLists?.[0]?.regionProviders.length).toBe(114);

      // Item region provider should match from "build/TerriaJS/data/regionMapping.json"
      expect(item.activeTableStyle.regionColumn?.regionType?.description).toBe(
        "Local Government Areas 2011 by name (ABS)"
      );
    });
  });

  describe("creates legend", function() {
    it(" - correct decimal places for values [0,100]", async function() {
      item.setTrait("definition", "csvString", LegendDecimalPlacesCsv);

      item.setTrait("definition", "activeStyle", "0dp");

      await item.loadMapItems();

      expect(item.legends[0].items.length).toBe(7);
      expect(item.legends[0].items.map(i => i.title)).toEqual([
        "65",
        "54",
        "44",
        "33",
        "22",
        "12",
        "1"
      ]);
    });

    it(" - correct decimal places for values [0,10]", async function() {
      item.setTrait("definition", "csvString", LegendDecimalPlacesCsv);

      item.setTrait("definition", "activeStyle", "1dp");

      await item.loadMapItems();

      expect(item.legends[0].items.length).toBe(7);
      expect(item.legends[0].items.map(i => i.title)).toEqual([
        "10.0",
        "8.3",
        "6.7",
        "5.0",
        "3.3",
        "1.7",
        "0.0"
      ]);
    });

    it(" - correct decimal places for values [0,1]", async function() {
      item.setTrait("definition", "csvString", LegendDecimalPlacesCsv);

      item.setTrait("definition", "activeStyle", "2dp");

      await item.loadMapItems();

      expect(item.legends[0].items.length).toBe(7);
      expect(item.legends[0].items.map(i => i.title)).toEqual([
        "0.70",
        "0.58",
        "0.47",
        "0.35",
        "0.23",
        "0.12",
        "0.00"
      ]);
    });

    it(" - correct decimal places for values [0,0.1]", async function() {
      item.setTrait("definition", "csvString", LegendDecimalPlacesCsv);

      item.setTrait("definition", "activeStyle", "3dp");

      await item.loadMapItems();

      expect(item.legends[0].items.length).toBe(7);
      expect(item.legends[0].items.map(i => i.title)).toEqual([
        "0.080",
        "0.068",
        "0.057",
        "0.045",
        "0.033",
        "0.022",
        "0.010"
      ]);
    });
  });

  describe("region mapping - LGA with disambig", function() {
    beforeEach(async function() {
      item.setTrait(CommonStrata.user, "csvString", LgaWithDisambigCsv);
      await item.loadMapItems();

      await item.regionProviderLists?.[0]
        ?.getRegionProvider("LGA_NAME_2011")
        ?.loadRegionIDs();
      await item.regionProviderLists?.[0]
        ?.getRegionProvider("STE_NAME_2016")
        ?.loadRegionIDs();
    });

    it("creates imagery parts", async function() {
      expect(ImageryParts.is(item.mapItems[0])).toBeTruthy();
    });

    it("with state", async function() {
      updateModelFromJson(item, CommonStrata.user, {
        columns: [
          {
            name: "State",
            regionType: "STE_NAME_2016"
          }
        ],
        defaultStyle: {
          regionColumn: "State"
        }
      });

      expect(item.activeTableStyle.regionColumn?.name).toBe("State");
      expect(item.activeTableStyle.regionColumn?.regionType?.regionType).toBe(
        "STE_NAME_2016"
      );

      expect(
        item.activeTableStyle.regionColumn?.valuesAsRegions.numberOfValidRegions
      ).toBe(8);
      expect(
        item.activeTableStyle.regionColumn?.valuesAsRegions.uniqueRegionIds
          .length
      ).toBe(3);
    });

    it("with lga_name", async function() {
      updateModelFromJson(item, CommonStrata.user, {
        columns: [
          {
            name: "LGA_NAME",
            regionType: "LGA_NAME_2011"
          }
        ],
        defaultStyle: {
          regionColumn: "LGA_NAME"
        }
      });

      expect(item.activeTableStyle.regionColumn?.name).toBe("LGA_NAME");
      expect(item.activeTableStyle.regionColumn?.regionType?.regionType).toBe(
        "LGA_NAME_2011"
      );

      expect(
        item.activeTableStyle.regionColumn?.valuesAsRegions.numberOfValidRegions
      ).toBe(8);
      expect(
        item.activeTableStyle.regionColumn?.valuesAsRegions.uniqueRegionIds
          .length
      ).toBe(8);
    });

    it("matches column name with whitespace", async function() {
      item.setTrait(
        CommonStrata.user,
        "csvString",
        `lga code-_-2015,number
        35740,1
        36720,2
        `
      );

      await item.loadMapItems();

      expect(item.activeTableStyle.regionColumn?.name).toBe("lga code-_-2015");
      expect(item.activeTableStyle.regionColumn?.regionType?.regionType).toBe(
        "LGA_2015"
      );
    });

    it("shows region shortReportSection", async function() {
      const regionCol = item.activeTableStyle.regionColumn;

      const regionType = regionCol?.regionType;

      expect(regionType).toBeDefined();

      expect(item.shortReportSections[0].name).toBe(
        `**Regions:** ${regionType?.description}`
      );
    });

    it("doesn't show region shortReportSection if region is disabled", async function() {
      updateModelFromJson(item, CommonStrata.user, {
        defaultStyle: {
          regionColumn: "Something else"
        }
      });

      expect(item.shortReportSections.length).toBe(0);
    });
  });

  describe("applies TableStyles to lat/lon features", function() {
    it("bin outline style with points", async function() {
      item.setTrait(CommonStrata.user, "csvString", LatLonValCsv);

      item.setTrait(CommonStrata.user, "styles", [
        createStratumInstance(TableStyleTraits, {
          id: "test-style",
          color: createStratumInstance(TableColorStyleTraits, {
            colorColumn: "value",
            colorPalette: "Greens",
            numberOfBins: 7
          }),
          point: createStratumInstance(TablePointStyleTraits, {
            column: "value",
            bin: [
              createStratumInstance(BinPointSymbolTraits, {
                maxValue: 1,
                marker: "point",
                height: 20
              }),
              createStratumInstance(BinPointSymbolTraits, {
                maxValue: 3,
                marker: "point",
                height: 10
              }),
              createStratumInstance(BinPointSymbolTraits, {
                maxValue: 5,
                marker: "point",
                height: 30
              })
            ]
          }),
          outline: createStratumInstance(TableOutlineStyleTraits, {
            column: "value",
            bin: [
              createStratumInstance(BinOutlineSymbolTraits, {
                maxValue: 1,
                color: "rgb(0,0,0)",
                width: 1
              }),
              createStratumInstance(BinOutlineSymbolTraits, {
                maxValue: 3,
                color: "rgb(255,0,0)",
                width: 2
              }),
              createStratumInstance(BinOutlineSymbolTraits, {
                maxValue: 5,
                color: "rgb(0,255,0)",
                width: 3
              })
            ]
          })
        })
      ]);
      item.setTrait(CommonStrata.user, "activeStyle", "test-style");

      await item.loadMapItems();

      const mapItem = item.mapItems[0] as CustomDataSource;

      const styles = [
        {
          fillColor: "rgb(35,139,69)",
          outlineColor: "rgb(0,255,0)",
          outlineWidth: 3,
          pixelSize: 30
        },
        {
          fillColor: "rgb(116,196,118)",
          outlineColor: "rgb(255,0,0)",
          outlineWidth: 2,
          pixelSize: 10
        },
        {
          fillColor: "rgb(186,228,179)",
          outlineColor: "rgb(0,0,0)",
          outlineWidth: 1,
          pixelSize: 20
        },
        {
          fillColor: "rgb(237,248,233)",
          outlineColor: "rgb(0,0,0)",
          outlineWidth: 1,
          pixelSize: 20
        },
        {
          fillColor: "rgb(116,196,118)",
          outlineColor: "rgb(255,0,0)",
          outlineWidth: 2,
          pixelSize: 10
        }
      ];

      styles.forEach((style, index) => {
        const feature = mapItem.entities.values[index];
        expect(
          feature.point?.color
            ?.getValue(item.terria.timelineClock.currentTime)
            ?.toCssColorString()
        ).toBe(style.fillColor);

        expect(
          feature.point?.outlineColor
            ?.getValue(item.terria.timelineClock.currentTime)
            ?.toCssColorString()
        ).toBe(style.outlineColor);

        expect(
          feature.point?.outlineWidth?.getValue(
            item.terria.timelineClock.currentTime
          )
        ).toBe(style.outlineWidth);

        expect(
          feature.point?.pixelSize?.getValue(
            item.terria.timelineClock.currentTime
          )
        ).toBe(style.pixelSize);
      });
    });

    it("bin color and outline style with markers", async function() {
      item.setTrait(CommonStrata.user, "csvString", LatLonValCsv);

      item.setTrait(CommonStrata.user, "styles", [
        createStratumInstance(TableStyleTraits, {
          id: "test-style",
          color: createStratumInstance(TableColorStyleTraits, {
            nullColor: "rgb(0,255,255)"
          }),
          point: createStratumInstance(TablePointStyleTraits, {
            column: "value",
            bin: [
              createStratumInstance(BinPointSymbolTraits, {
                maxValue: 1,
                marker: "circle",
                height: 20,
                width: 10
              }),
              createStratumInstance(BinPointSymbolTraits, {
                maxValue: 3,
                marker: "cross",
                height: 10,
                width: 5
              }),
              createStratumInstance(BinPointSymbolTraits, {
                maxValue: 5,
                marker: "hospital",
                height: 30,
                width: 15,
                rotation: 45
              })
            ]
          }),
          outline: createStratumInstance(TableOutlineStyleTraits, {
            null: createStratumInstance(BinOutlineSymbolTraits, {
              maxValue: 1,
              color: "rgb(0,0,255)",
              width: 1
            })
          })
        })
      ]);
      item.setTrait(CommonStrata.user, "activeStyle", "test-style");

      await item.loadMapItems();

      const mapItem = item.mapItems[0] as CustomDataSource;

      const styles = [
        {
          fillColor: "rgb(0,255,255)",
          outlineColor: "rgb(0,0,255)",
          outlineWidth: 1,
          marker: "hospital",
          height: 30,
          width: 15,
          rotation: ((360 - 45) / 360) * (2 * Math.PI)
        },
        {
          fillColor: "rgb(0,255,255)",
          outlineColor: "rgb(0,0,255)",
          outlineWidth: 1,
          marker: "cross",
          height: 10,
          width: 5,
          rotation: 2 * Math.PI
        },
        {
          fillColor: "rgb(0,255,255)",
          outlineColor: "rgb(0,0,255)",
          outlineWidth: 1,
          marker: "circle",
          height: 20,
          width: 10,
          rotation: 2 * Math.PI
        },
        {
          fillColor: "rgb(0,255,255)",
          outlineColor: "rgb(0,0,255)",
          outlineWidth: 1,
          marker: "circle",
          height: 20,
          width: 10,
          rotation: 2 * Math.PI
        },
        {
          fillColor: "rgb(0,255,255)",
          outlineColor: "rgb(0,0,255)",
          outlineWidth: 1,
          marker: "cross",
          height: 10,
          width: 5,
          rotation: 2 * Math.PI
        }
      ];

      styles.forEach((style, index) => {
        const feature = mapItem.entities.values[index];

        expect(
          feature.billboard?.rotation?.getValue(
            item.terria.timelineClock.currentTime
          )
        ).toBeCloseTo(style.rotation);

        expect(
          feature.billboard?.image?.getValue(
            item.terria.timelineClock.currentTime
          )
        ).toBe(
          getMakiIcon(
            style.marker,
            style.fillColor,
            style.outlineWidth,
            style.outlineColor,
            style.height,
            style.width
          )
        );
      });

      // Test merging legends

      expect(
        item.legends[0].items.map(item => ({
          title: item.title,
          outlineColor: item.outlineColor,
          outlineWidth: item.outlineWidth,
          imageHeight: item.imageHeight,
          imageWidth: item.imageWidth,
          color: item.color,
          marker: item.marker,
          rotation: item.rotation
        }))
      ).toEqual([
        {
          title: "3 to 5",
          color: "rgb(0,255,255)",
          outlineColor: "rgb(0,0,255)",
          outlineWidth: 1,
          marker: "hospital",
          rotation: 45,
          imageHeight: 24,
          imageWidth: 24
        },
        {
          title: "1 to 3",
          color: "rgb(0,255,255)",
          outlineColor: "rgb(0,0,255)",
          outlineWidth: 1,
          marker: "cross",
          imageHeight: 24,
          imageWidth: 24,
          rotation: 0
        },
        {
          title: "-1 to 1",
          color: "rgb(0,255,255)",
          outlineColor: "rgb(0,0,255)",
          outlineWidth: 1,
          marker: "circle",
          imageHeight: 24,
          imageWidth: 24,
          rotation: 0
        }
      ]);
    });

    it("enum outline style with points", async function() {
      item.setTrait(CommonStrata.user, "csvString", LatLonEnumCsv);

      item.setTrait(CommonStrata.user, "styles", [
        createStratumInstance(TableStyleTraits, {
          id: "test-style",
          color: createStratumInstance(TableColorStyleTraits, {
            nullColor: "rgb(255,0,255)"
          }),
          point: createStratumInstance(TablePointStyleTraits, {
            column: "enum",
            enum: [
              createStratumInstance(EnumPointSymbolTraits, {
                value: "hello",
                height: 20
              }),
              createStratumInstance(EnumPointSymbolTraits, {
                value: "boots",
                height: 10
              }),
              createStratumInstance(EnumPointSymbolTraits, {
                value: "frogs",
                height: 30
              })
            ]
          }),
          outline: createStratumInstance(TableOutlineStyleTraits, {
            column: "enum",
            enum: [
              createStratumInstance(EnumOutlineSymbolTraits, {
                value: "hello",
                color: "rgb(0,0,0)",
                width: 1
              }),
              createStratumInstance(EnumOutlineSymbolTraits, {
                value: "boots",
                color: "rgb(255,0,0)",
                width: 2
              }),
              createStratumInstance(EnumOutlineSymbolTraits, {
                value: "frogs",
                color: "rgb(0,255,0)",
                width: 3
              })
            ]
          })
        })
      ]);
      item.setTrait(CommonStrata.user, "activeStyle", "test-style");

      await item.loadMapItems();

      const mapItem = item.mapItems[0] as CustomDataSource;

      const styles = [
        {
          fillColor: "rgb(255,0,255)",
          outlineColor: "rgb(0,0,0)",
          outlineWidth: 1,
          pixelSize: 20
        },
        {
          fillColor: "rgb(255,0,255)",
          outlineColor: "rgb(255,0,0)",
          outlineWidth: 2,
          pixelSize: 10
        },
        {
          fillColor: "rgb(255,0,255)",
          outlineColor: "rgb(0,255,0)",
          outlineWidth: 3,
          pixelSize: 30
        },
        {
          fillColor: "rgb(255,0,255)",
          outlineColor: "rgb(255,0,0)",
          outlineWidth: 2,
          pixelSize: 10
        },
        {
          fillColor: "rgb(255,0,255)",
          outlineColor: "rgb(0,0,0)",
          outlineWidth: 1,
          pixelSize: 20
        }
      ];

      styles.forEach((style, index) => {
        const feature = mapItem.entities.values[index];
        expect(
          feature.point?.color
            ?.getValue(item.terria.timelineClock.currentTime)
            ?.toCssColorString()
        ).toBe(style.fillColor);

        expect(
          feature.point?.outlineColor
            ?.getValue(item.terria.timelineClock.currentTime)
            ?.toCssColorString()
        ).toBe(style.outlineColor);

        expect(
          feature.point?.outlineWidth?.getValue(
            item.terria.timelineClock.currentTime
          )
        ).toBe(style.outlineWidth);

        expect(
          feature.point?.pixelSize?.getValue(
            item.terria.timelineClock.currentTime
          )
        ).toBe(style.pixelSize);

        // Test merging legends

        expect(
          item.legends[0].items.map(item => ({
            title: item.title,
            outlineColor: item.outlineColor,
            outlineWidth: item.outlineWidth,
            imageHeight: item.imageHeight,
            imageWidth: item.imageWidth
          }))
        ).toEqual([
          {
            title: "hello",
            outlineColor: "rgb(0,0,0)",
            outlineWidth: 1,
            imageHeight: 24,
            imageWidth: 24
          },
          {
            title: "boots",
            outlineColor: "rgb(255,0,0)",
            outlineWidth: 2,
            imageHeight: 24,
            imageWidth: 24
          },
          {
            title: "frogs",
            outlineColor: "rgb(0,255,0)",
            outlineWidth: 3,
            imageHeight: 24,
            imageWidth: 24
          }
        ]);
      });
    });
  });
});
