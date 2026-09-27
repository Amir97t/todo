import { LIST_ICON_COMPONENTS } from "../../lib/listIcons";

export default function ListIcon({
  icon = "folder",
  size = 17,
  strokeWidth = 1.9,
  ...props
}) {
  const Icon = LIST_ICON_COMPONENTS[icon] ?? LIST_ICON_COMPONENTS.folder;

  return <Icon size={size} strokeWidth={strokeWidth} {...props} />;
}
