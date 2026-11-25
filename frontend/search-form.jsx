export function SearchForm({ query = '', action = 'search/' }) {
  return (
    <form role="search" action={action} method="get">
      <label htmlFor="log-query">Search the logbook</label>
      <div className="search-fields">
        <input type="search" id="log-query" name="q" placeholder="Try yellowfin or July 1998" defaultValue={query} />
        <button type="submit">Search</button>
      </div>
    </form>
  );
}
