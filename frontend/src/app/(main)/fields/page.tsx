'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import FieldCard from '@/components/fields/FieldCard';
import fieldService, { FieldFilters } from '@/services/field.service';
import type { Field } from '@/types';
import { Search, SlidersHorizontal, MapPin } from 'lucide-react';

const FIELD_TYPES = ['5v5', '7v7', '11v11'];
const SORT_OPTIONS = [
  { value: 'rating', label: 'Đánh giá cao nhất' },
  { value: 'popular', label: 'Phổ biến nhất' },
  { value: 'price', label: 'Giá thấp nhất' },
  { value: 'newest', label: 'Mới nhất' },
];

export default function FieldsPage() {
  const [filters, setFilters] = useState<FieldFilters>({
    page: 1,
    limit: 12,
    sort: 'rating',
  });
  const [searchInput, setSearchInput] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['fields', filters],
    queryFn: () => fieldService.getFields(filters),
  });

  const fields: Field[] = data?.data?.data?.fields ?? [];
  const pagination = data?.data?.meta?.pagination;

  const handleSearch = () => {
    setFilters((f) => ({ ...f, search: searchInput, page: 1 }));
  };

  const toggleFieldType = (type: string) => {
    setFilters((f) => ({ ...f, fieldType: f.fieldType === type ? undefined : type, page: 1 }));
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Tìm sân bóng</h1>
        <p className="text-muted-foreground mt-1">Hàng trăm sân bóng chất lượng trên toàn quốc</p>
      </div>

      {/* Search + Filters */}
      <div className="mb-6 space-y-4">
        {/* Search bar */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Tên sân, địa chỉ..."
              className="pl-9"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>
          <Button onClick={handleSearch} className="bg-primary hover:bg-primary/90">
            Tìm kiếm
          </Button>
        </div>

        {/* Filter row */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1">
            <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Lọc:</span>
          </div>

          {/* Field type filter */}
          {FIELD_TYPES.map((type) => (
            <Badge
              key={type}
              variant={filters.fieldType === type ? 'default' : 'outline'}
              className={`cursor-pointer ${filters.fieldType === type ? 'bg-primary hover:bg-primary/90' : 'hover:bg-accent'}`}
              onClick={() => toggleFieldType(type)}
            >
              {type}
            </Badge>
          ))}

          {/* City filter */}
          <Input
            placeholder="Thành phố"
            className="w-36 h-8 text-sm"
            value={filters.city ?? ''}
            onChange={(e) => setFilters((f) => ({ ...f, city: e.target.value || undefined, page: 1 }))}
          />

          {/* Sort */}
          <Select value={filters.sort} onValueChange={(v) => v && setFilters((f) => ({ ...f, sort: v }))}>
            <SelectTrigger className="w-44 h-8 text-sm">
              <SelectValue placeholder="Sắp xếp" />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Results info */}
      {!isLoading && pagination && (
        <p className="text-sm text-muted-foreground mb-4">
          Tìm thấy <strong>{pagination.total}</strong> sân bóng
        </p>
      )}

      {/* Field Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-72 rounded-xl" />
          ))}
        </div>
      ) : fields.length === 0 ? (
        <div className="text-center py-16">
          <MapPin className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-lg font-medium">Không tìm thấy sân bóng</p>
          <p className="text-muted-foreground text-sm mt-1">Hãy thử thay đổi bộ lọc</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {fields.map((field) => (
            <FieldCard key={field._id} field={field} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-10">
          <Button
            variant="outline"
            disabled={!pagination.hasPrevPage}
            onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) - 1 }))}
          >
            Trước
          </Button>
          <span className="flex items-center px-4 text-sm">
            Trang {pagination.page} / {pagination.totalPages}
          </span>
          <Button
            variant="outline"
            disabled={!pagination.hasNextPage}
            onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) + 1 }))}
          >
            Sau
          </Button>
        </div>
      )}
    </div>
  );
}
