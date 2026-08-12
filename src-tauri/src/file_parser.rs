use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use calamine::{open_workbook, Reader, Xlsx, Xls};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParsedRecord {
    pub fields: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParseResult {
    pub records: Vec<ParsedRecord>,
    pub headers: Vec<String>,
    pub errors: Vec<String>,
    pub warnings: Vec<String>,
}

pub fn parse_csv(path: &str) -> Result<ParseResult, String> {
    let mut reader = csv::ReaderBuilder::new()
        .has_headers(true)
        .flexible(true)
        .from_path(path)
        .map_err(|e| format!("CSV 解析失败: {}", e))?;

    let headers: Vec<String> = reader.headers()
        .map_err(|e| format!("读取表头失败: {}", e))?
        .iter()
        .map(|s| s.trim().to_string())
        .collect();

    let mut records = Vec::new();
    let mut errors = Vec::new();
    let mut warnings = Vec::new();

    for (i, result) in reader.records().enumerate() {
        match result {
            Ok(record) => {
                let mut fields = HashMap::new();
                for (j, header) in headers.iter().enumerate() {
                    let value = record.get(j).unwrap_or("").trim().to_string();
                    if value.is_empty() && is_required_field(header) {
                        warnings.push(format!("第 {} 行: {} 为空", i + 2, header));
                    }
                    fields.insert(header.clone(), value);
                }
                records.push(ParsedRecord { fields });
            }
            Err(e) => {
                errors.push(format!("第 {} 行解析错误: {}", i + 2, e));
            }
        }
    }

    Ok(ParseResult { records, headers, errors, warnings })
}

pub fn parse_excel(path: &str) -> Result<ParseResult, String> {
    if path.ends_with(".xlsx") {
        let mut workbook: Xlsx<_> = open_workbook(path)
            .map_err(|e| format!("Excel 解析失败: {}", e))?;
        let sheet_name = workbook.sheet_names().first().cloned()
            .ok_or_else(|| "工作簿中没有工作表".to_string())?;
        let range = workbook.worksheet_range(&sheet_name)
            .map_err(|e| format!("读取工作表失败: {}", e))?;
        parse_range(range)
    } else {
        let mut workbook: Xls<_> = open_workbook(path)
            .map_err(|e| format!("Excel 解析失败: {}", e))?;
        let sheet_name = workbook.sheet_names().first().cloned()
            .ok_or_else(|| "工作簿中没有工作表".to_string())?;
        let range = workbook.worksheet_range(&sheet_name)
            .map_err(|e| format!("读取工作表失败: {}", e))?;
        parse_range(range)
    }
}

fn parse_range(range: calamine::Range<calamine::Data>) -> Result<ParseResult, String> {
    let mut rows = range.rows();

    let headers: Vec<String> = match rows.next() {
        Some(row) => row.iter().map(|c| c.to_string().trim().to_string()).collect(),
        None => return Err("工作表为空".to_string()),
    };

    let mut records = Vec::new();
    let mut _errors = Vec::new();
    let mut warnings = Vec::new();

    for (i, row) in rows.enumerate() {
        let mut fields = HashMap::new();
        for (j, header) in headers.iter().enumerate() {
            let value = row.get(j).map(|c| c.to_string().trim().to_string()).unwrap_or_default();
            if value.is_empty() && is_required_field(header) {
                warnings.push(format!("第 {} 行: {} 为空", i + 2, header));
            }
            fields.insert(header.clone(), value);
        }
        records.push(ParsedRecord { fields });
    }

    Ok(ParseResult { records, headers, errors: _errors, warnings })
}

fn is_required_field(field: &str) -> bool {
    matches!(field.to_lowercase().as_str(), "username" | "samaccountname" | "用户名" | "姓名" | "displayname")
}

pub fn generate_csv_template(path: &str) -> Result<(), String> {
    let headers = vec![
        "sAMAccountName", "displayName", "mail", "department", "title",
        "telephoneNumber", "description", "userPrincipalName", "givenName", "sn",
    ];

    let mut writer = csv::Writer::from_path(path)
        .map_err(|e| format!("创建模板失败: {}", e))?;

    writer.write_record(&headers)
        .map_err(|e| format!("写入表头失败: {}", e))?;

    writer.write_record(&["zhangsan", "张三", "zhangsan@company.com", "技术部", "工程师", "13800138000", "", "zhangsan@company.com", "三", "张"])
        .map_err(|e| format!("写入示例失败: {}", e))?;

    writer.flush().map_err(|e| format!("刷新失败: {}", e))?;
    Ok(())
}
