import test from "node:test";
import assert from "node:assert/strict";
import {
  archivePathFor, existingEntryIds, insertEntries, isRelevant, parseNoticeBoard, renderEntry,
} from "./update-notice-board.mjs";

const item = {
  id: "https://www.praha12.cz/ražická/d-123",
  url: "https://www.praha12.cz/ražická/d-123",
  title: "OOP - Ražická",
  posted: "2026-11-10",
  relevantUntil: "2026-11-25",
  referenceNumber: "P12 123/2026 ODO",
  fileNumber: "",
  documents: [{ title: "Situace.pdf", url: "https://www.praha12.cz/assets/File.ashx?id_dokumenty=456" }],
};

test("parses official JSON-LD notice-board fields and document URLs", () => {
  const [parsed] = parseNoticeBoard({ informace: [{
    iri: item.id, url: item.url, název: { cs: item.title },
    vyvěšení: { datum: item.posted }, relevantní_do: { datum: item.relevantUntil },
    číslo_jednací: item.referenceNumber,
    dokument: [{ název: { cs: "Situace.pdf" }, url: "https://www.praha12.cz/assets/File.ashx?id_dokumenty=456&amp;token=x" }],
  }] });
  assert.equal(parsed.title, item.title);
  assert.equal(parsed.documents[0].url, "https://www.praha12.cz/assets/File.ashx?id_dokumenty=456&token=x");
});

test("uses focused local terms and creates stable archive paths", () => {
  assert.equal(isRelevant(item), true);
  assert.equal(isRelevant({ title: "OOP - Modřany" }), false);
  assert.equal(archivePathFor(item.documents[0], item.posted, "application/pdf"), "/assets/files/uredni-deska/2026/situace-456.pdf");
});

test("renders safe, searchable cards and never inserts duplicate IDs", () => {
  const entry = renderEntry(item, [{ ...item.documents[0], localUrl: "/assets/files/uredni-deska/2026/situace-456.pdf" }]);
  assert.match(entry, /data-notice-id="https%3A%2F%2Fwww.praha12.cz%2Fra%C5%BEick%C3%A1%2Fd-123"/);
  assert.match(entry, /id="oop-razicka-2026-11-10"/);
  assert.match(entry, /href="#oop-razicka-2026-11-10"/);
  assert.match(entry, /Přílohy uložené v archivu/);
  assert.match(entry, /Situace.pdf/);
  const source = "before\n    <!-- notice-board-entries -->\n    <!-- /notice-board-entries -->\nafter";
  const updated = insertEntries(source, [entry]);
  assert.equal(existingEntryIds(updated).has(item.id), true);
  assert.equal(existingEntryIds(updated).size, 1);
  const another = renderEntry({ ...item, id: "https://www.praha12.cz/kestřanská/d-124", title: "OOP - Kestřanská" }, []);
  const appended = insertEntries(updated, [another]);
  assert.equal(existingEntryIds(appended).size, 2);
  assert.match(appended, /OOP - Ražická/);
});