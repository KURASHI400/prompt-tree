import { database, activeWorkspace } from "../src/local/db";
import { cleanup } from "../src/local/maintenance";
import { deletionService } from "../src/local/deletionService";
import { cardRepository } from "../src/local/repository/cardRepository";
import { seriesRepository } from "../src/local/repository/seriesRepository";
import { imageRepository } from "../src/local/repository/imageRepository";
import { treeRepository } from "../src/local/repository/treeRepository";
import { searchRepository } from "../src/local/repository/searchRepository";
import { createBackup, snapshot } from "../src/local/backup/createBackup";
import { restoreBackup } from "../src/local/backup/restoreBackup";
import { fileStore } from "../src/local/files/fileStore";
import { IndexedDbBlobFileStore } from "../src/local/files/IndexedDbBlobFileStore";
const helper = {
  cleanup,
  deletionService,
  database,
  activeWorkspace,
  cardRepository,
  seriesRepository,
  imageRepository,
  treeRepository,
  searchRepository,
  createBackup,
  restoreBackup,
  snapshot,
  fileStore,
  IndexedDbBlobFileStore,
};
// Bundled and injected by Playwright only. This file is outside the application entry graph.
Object.assign(window, { localTest: helper });
declare global {
  interface Window {
    localTest: typeof helper;
  }
}
