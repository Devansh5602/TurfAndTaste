import React, { useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import {
  BottomNavigation,
  Header,
  ServiceFilters,
  VenueCard,
} from "./components";
import { matchesService, venues } from "./fixtures";
export default function Facilities({ onNotice }) {
  const [selected, setSelected] = useState("All");
  const [search, setSearch] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const filtered = venues.filter(
    (v) =>
      matchesService(v, selected) &&
      `${v.name} ${v.location} ${v.services.join(" ")}`
        .toLowerCase()
        .includes(search.trim().toLowerCase()),
  );
  return (
    <>
      <Header venues onNotice={onNotice} />
      <main className="facilities-page">
        <div className="search-row">
          <label className="search-field">
            <Search size={19} />
            <input
              aria-label="Search arenas, turfs, sports"
              placeholder="Search arenas, turfs, sports..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <button
            className="filter-button"
            aria-label="Activity filters"
            aria-expanded={filterOpen}
            onClick={() => setFilterOpen(!filterOpen)}
          >
            <SlidersHorizontal size={21} />
          </button>
        </div>
        <ServiceFilters selected={selected} onChange={setSelected} />
        {filterOpen && (
          <div className="filter-panel">
            <p>Filter venues by activity using the chips above.</p>
            <button
              onClick={() => {
                setSelected("All");
                setSearch("");
                setFilterOpen(false);
              }}
            >
              Reset filters
            </button>
          </div>
        )}
        <div className="availability">
          <span>
            <i />
            {filtered.length} Arenas Open in Bopal District
          </span>
          <strong>FAST BOOKING</strong>
        </div>
        <div className="card-stack">
          {filtered.map((v) => (
            <VenueCard key={v.image} venue={v} />
          ))}
        </div>
        {!filtered.length && (
          <div className="empty-state">
            <p>No matching arenas.</p>
            <button
              onClick={() => {
                setSelected("All");
                setSearch("");
              }}
            >
              Clear filters
            </button>
          </div>
        )}
      </main>
      <BottomNavigation active="Venues" onNotice={onNotice} />
    </>
  );
}
