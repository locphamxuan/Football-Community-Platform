import Link from 'next/link';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import type { Field } from '@/types';
import { Star, MapPin, Clock } from 'lucide-react';

interface Props {
  field: Field;
}

const formatPrice = (n: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);

export default function FieldCard({ field }: Props) {
  const minPrice = Math.min(
    field.pricing.weekday.morning,
    field.pricing.weekday.afternoon,
    field.pricing.weekday.evening
  );

  return (
    <Link href={`/fields/${field._id}`}>
      <Card className="group overflow-hidden hover:shadow-lg transition-shadow cursor-pointer h-full">
        {/* Thumbnail */}
        <div className="relative h-44 bg-gray-100">
          {field.images[0] ? (
            <Image
              src={field.images[0]}
              alt={field.name}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <span className="text-4xl">⚽</span>
            </div>
          )}

          {/* Field type badges */}
          <div className="absolute top-2 left-2 flex gap-1 flex-wrap">
            {field.subFields
              .filter((sf, i, arr) => arr.findIndex((x) => x.fieldType === sf.fieldType) === i)
              .map((sf) => (
                <Badge key={sf.fieldType} className="bg-green-600 text-white text-xs">
                  {sf.fieldType}
                </Badge>
              ))}
          </div>

          {/* Verified */}
          {field.isVerified && (
            <div className="absolute top-2 right-2">
              <Badge className="bg-blue-600 text-white text-xs">✓ Xác minh</Badge>
            </div>
          )}
        </div>

        <CardContent className="p-4 space-y-2">
          {/* Name */}
          <h3 className="font-semibold text-gray-900 line-clamp-1 group-hover:text-green-600 transition-colors">
            {field.name}
          </h3>

          {/* Location */}
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="line-clamp-1">{field.location.district}, {field.location.city}</span>
          </div>

          {/* Operating hours */}
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>{field.operatingHours.open} – {field.operatingHours.close}</span>
          </div>

          {/* Rating + Price */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-1">
              <Star className="h-3.5 w-3.5 text-yellow-400 fill-yellow-400" />
              <span className="text-sm font-medium">{field.rating.average.toFixed(1)}</span>
              <span className="text-xs text-muted-foreground">({field.rating.count})</span>
            </div>
            <div className="text-right">
              <span className="text-xs text-muted-foreground">từ </span>
              <span className="text-sm font-semibold text-green-600">{formatPrice(minPrice)}/h</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
