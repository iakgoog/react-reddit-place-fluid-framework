import React, { useEffect } from 'react';

import './Table.css';

import { SharedMap } from 'fluid-framework';
import { TinyliciousClient } from '@fluidframework/tinylicious-client';

import {
  Column,
  Table,
  ColumnDef,
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  RowData
} from '@tanstack/react-table';
import { makeData, Person } from '../lib/makeData';

declare module '@tanstack/react-table' {
  type TableMeta<TData extends RowData> = {
    updateData: (rowIndex: number, columnId: string, value: unknown) => void;
  };
}

const domain = 'https://app.iakgoog.link';
const port = 443;

const connectionConfig = { connection: { domain, port } };

const client = new TinyliciousClient(connectionConfig);

const containerSchema = {
  initialObjects: {
    tiles: SharedMap
  }
};

const getFluidData = async () => {
  // Get the container from the Fluid service
  let container;

  let initial = false;
  // eslint-disable-next-line no-restricted-globals
  const containerId = location.hash.substring(1);
  if (!containerId) {
    console.log('No container id');
    ({ container } = await client.createContainer(containerSchema));
    const id = await container.attach();
    // Set the UUID for the container in the URI
    // eslint-disable-next-line no-restricted-globals
    location.hash = id;
    initial = true;
  } else {
    ({ container } = await client.getContainer(containerId, containerSchema));
  }

  const { initialObjects } = container;

  if (initial) {
    makeData(5).forEach((person: Person, index: number) => {
      initialObjects.tiles.set(index.toString(), person);
    });
  }

  return {
    initialObjects,
    initial
  };
};

// Give our default column cell renderer editing superpowers!
const defaultColumn: Partial<ColumnDef<Person>> = {
  cell: ({ getValue, row: { index }, column: { id }, table }) => {
    const initialValue = getValue();
    // We need to keep and update the state of the cell normally
    const [value, setValue] = React.useState(initialValue);

    // When the input is blurred, we'll call our table meta's updateData function
    const onBlur = e => {
      table.options.meta?.updateData(index, id, value);
    };

    // const onChange = () => {

    // }

    // If the initialValue is changed external, sync it up with our state
    React.useEffect(() => {
      setValue(initialValue);
    }, [initialValue]);

    if (id === 'currency') {
      return <strong>{value as string}</strong>;
    }
    return <input type="number" value={value as string} onChange={e => setValue(e.target.value)} onBlur={onBlur} />;
  }
};

function useSkipper() {
  const shouldSkipRef = React.useRef(true);
  const shouldSkip = shouldSkipRef.current;

  // Wrap a function with this to skip a pagination reset temporarily
  const skip = React.useCallback(() => {
    shouldSkipRef.current = false;
  }, []);

  React.useEffect(() => {
    shouldSkipRef.current = true;
  });

  return [shouldSkip, skip] as const;
}

function TableView() {
  const rerender = React.useReducer(() => ({}), {})[1];

  const columns = React.useMemo<ColumnDef<Person>[]>(
    () => [
      {
        header: 'Trade',
        footer: props => props.column.id,
        columns: [
          {
            accessorKey: 'currency',
            header: 'Currency',
            footer: props => props.column.id
          },
          {
            accessorKey: 'bid',
            header: 'Bid',
            footer: props => props.column.id
          },
          {
            accessorKey: 'ask',
            header: 'Ask',
            footer: props => props.column.id
          }
        ]
      }
    ],
    []
  );

  // const [synchTiles, setSynchTiles] = React.useState<any | null>(null);
  const [tiles, setTiles] = React.useState<any | null>(() => makeData(10));
  const refreshData = () => setTiles(() => makeData(10));
  useEffect(() => {
    getFluidData().then(data => {
      if (data) {
        setTiles(data.initialObjects.tiles);
      }
    });
  }, []);

  const [viewData, setViewData] = React.useState<any | null>([]);
  React.useEffect(() => {
    if (tiles instanceof SharedMap) {
      // Sync Fluid data into view state

      const syncView = (newTiles?: any) => {
        const tempSync = [];
        tiles.forEach((item, index) => (tempSync[index] = item));
        setViewData(tempSync);
      };
      // const syncView = () => {
      //   console.log('YES');
      // };
      // Ensure sync runs at least once
      syncView();
      // Update state each time our map changes
      tiles.on('valueChanged', syncView);
      // Turn off SharedMap listener when component is unmounted
      return () => {
        tiles.off('valueChanged', syncView);
      };
    }
  }, [tiles]);

  const [autoResetPageIndex, skipAutoResetPageIndex] = useSkipper();

  const table = useReactTable({
    data: viewData,
    columns,
    defaultColumn,
    getCoreRowModel: getCoreRowModel(),
    // getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    autoResetPageIndex,
    // Provide our updateData function to our table meta
    meta: {
      updateData: (rowIndex, columnId, value) => {
        // Skip age index reset until after next rerender
        // skipAutoResetPageIndex();

        const getRow = tiles.get(rowIndex.toString());
        if (getRow) {
          tiles.set(rowIndex, {
            ...viewData[rowIndex.toString()],
            [columnId]: parseInt(value, 10)
          });
        }
      }
    },
    debugTable: true
  });

  return (
    <div className="p-2">
      <div className="h-2" />
      <table>
        <thead>
          {table.getHeaderGroups().map(headerGroup => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map(header => {
                return (
                  <th key={header.id} colSpan={header.colSpan}>
                    {header.isPlaceholder ? null : (
                      <div>
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {/* {header.column.getCanFilter() ? (
                          <div>
                            <Filter column={header.column} table={table} />
                          </div>
                        ) : null} */}
                      </div>
                    )}
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map(row => {
            return (
              <tr key={row.id}>
                {row.getVisibleCells().map(cell => {
                  return <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>;
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="h-2" />
      {/* <div className="flex items-center gap-2">
        <button
          className="border rounded p-1"
          onClick={() => table.setPageIndex(0)}
          disabled={!table.getCanPreviousPage()}
        >
          {'<<'}
        </button>
        <button
          className="border rounded p-1"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          {'<'}
        </button>
        <button className="border rounded p-1" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
          {'>'}
        </button>
        <button
          className="border rounded p-1"
          onClick={() => table.setPageIndex(table.getPageCount() - 1)}
          disabled={!table.getCanNextPage()}
        >
          {'>>'}
        </button>
        <span className="flex items-center gap-1">
          <div>Page</div>
          <strong>
            {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
          </strong>
        </span>
        <span className="flex items-center gap-1">
          | Go to page:
          <input
            type="number"
            defaultValue={table.getState().pagination.pageIndex + 1}
            onChange={e => {
              const page = e.target.value ? Number(e.target.value) - 1 : 0;
              table.setPageIndex(page);
            }}
            className="border p-1 rounded w-16"
          />
        </span>
        <select
          value={table.getState().pagination.pageSize}
          onChange={e => {
            table.setPageSize(Number(e.target.value));
          }}
        >
          {[10, 20, 30, 40, 50].map(pageSize => (
            <option key={pageSize} value={pageSize}>
              Show {pageSize}
            </option>
          ))}
        </select>
      </div> */}
      {/* <div>{table.getRowModel().rows.length} Rows</div> */}
      {/* <div>
        <button onClick={() => rerender()}>Force Rerender</button>
      </div>
      <div>
        <button onClick={() => refreshData()}>Refresh Data</button>
      </div> */}
    </div>
  );
}
function Filter({ column, table }: { column: Column<any, any>; table: Table<any> }) {
  const firstValue = table.getPreFilteredRowModel().flatRows[0]?.getValue(column.id);

  const columnFilterValue = column.getFilterValue();

  return typeof firstValue === 'number' ? (
    <div className="flex space-x-2">
      <input
        type="number"
        value={(columnFilterValue as [number, number])?.[0] ?? ''}
        onChange={e => column.setFilterValue((old: [number, number]) => [e.target.value, old?.[1]])}
        placeholder={`Min`}
        className="w-24 border shadow rounded"
      />
      <input
        type="number"
        value={(columnFilterValue as [number, number])?.[1] ?? ''}
        onChange={e => column.setFilterValue((old: [number, number]) => [old?.[0], e.target.value])}
        placeholder={`Max`}
        className="w-24 border shadow rounded"
      />
    </div>
  ) : (
    <input
      type="text"
      value={(columnFilterValue ?? '') as string}
      onChange={e => column.setFilterValue(e.target.value)}
      placeholder={`Search...`}
      className="w-36 border shadow rounded"
    />
  );
}

export default TableView;
