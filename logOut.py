from collections.abc import Mapping
import datetime


def size(var):
    result = 0
    if isinstance(var, bool):
        result += 1
    elif isinstance(var, (float, int)):
        if len(str(var).replace('.', '')) >= 8:
            result += 5
        else:
            result += 2
    elif isinstance(var, str):
        if len(var) >= 14:
            result += 5
        else:
            result += 1
    elif isinstance(var, (list, tuple)):
        for elem in var:
            result += size(elem)
    elif isinstance(var, (dict, Mapping)):
        for elem in var.values():
            result += size(elem)
    else:
        result += 25
    return result

def cut(texte, level=1, limite=55):
    if len(texte) <= limite:
        return texte
        
    result = ''
    last_index = 0
    size_txt = len(texte)
    
    while last_index + limite < size_txt:
        index = last_index + limite
        temp_index = index
        while temp_index > last_index and texte[temp_index] != " ":
            temp_index -= 1
            
        if temp_index > last_index:
            result += texte[last_index:temp_index] + '\n' + "    " * level
            last_index = temp_index + 1
        else:
            result += texte[last_index:index] + '\n' + "    " * level
            last_index = index
            
    result += texte[last_index:]
    return result

def PrettyPrint(*args, level=0, start=True, kool=False):
    parts = []
    for var in args:
        base_indent = '    ' * level
        start_indent = '' if kool else base_indent
        result = ''
        
        if isinstance(var, (int, float, bool)):
            result += f"{start_indent}{var}"
            
        elif isinstance(var, str):
            text_to_cut = var if '\n' in var else repr(var)
            result += f"{start_indent}{cut(text_to_cut, level + 1)}"
            
        elif isinstance(var, (list, tuple)):
            opening, closing = ('[', ']') if isinstance(var, list) else ('(', ')')
            
            has_dict = any(isinstance(e, (dict, Mapping)) for e in var)
            
            if size(var) <= 10 and not has_dict:
                elements = [PrettyPrint(elem, level=level + 1, start=False, kool=True) for elem in var]
                content = ", ".join(elements)
                result += f"{start_indent}{opening} {content} {closing}"
            else:
                res_list = [f"{start_indent}{opening}"]
                for element in var:
                    res_list.append(PrettyPrint(element, level=level + 1, start=False) + ",")
                
                if len(res_list) > 1:
                    res_list[-1] = res_list[-1][:-1]
                    
                res_list.append(f"{base_indent}{closing}")
                result += "\n".join(res_list)
                
        elif isinstance(var, (dict, Mapping)):
            opening, closing = ('{', '}')
            result += f"{start_indent}{opening}\n" 
            
            if var:
                for key, value in var.items():
                    key_indent = '    ' * (level + 1)
                    prefix = f"{key_indent}{repr(key)} : "
                    result += f"{prefix}{PrettyPrint(value, level=level + 1, start=False, kool=True)},\n"
                
                result = result[:-2] + '\n'
            
            result += f"{base_indent}{closing}"
        
        elif isinstance(var, (datetime.date, datetime.datetime)):
            result += f"{start_indent}'{str(var)}'"

        else:
            result += f"{start_indent}{repr(var)}"

        parts.append(result)
        
    separator = "\n" if start else ""
    final_output = separator.join(parts)

    if start:
        print(final_output)
    else:
        return final_output
