import { Book } from "lucide-react";
import { ICON_LIST } from "./IconPicker";

export const DynamicIcon = ({ name }: { name: string }) => {
  const IconComponent = ICON_LIST.find(i => i.name === name)?.Icon || Book;
  return <IconComponent size={24} className="text-blue-500" />;
};

