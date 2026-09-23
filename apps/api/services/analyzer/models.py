from pydantic import BaseModel, Field
from typing import Literal


class SectionInfo(BaseModel):
    name: str
    text: str
    word_count: int
    block_ids: list[str] = Field(default_factory=list)


class Block(BaseModel):
    id: str
    type: str
    text: str
    section: str | None = None
    word_count: int
    paragraph_index: int | None = None

class ValidationIssue(BaseModel):
    rule: str
    status: Literal["pass", "fail", "warning"]

    actual: int | str | bool | None = None
    limit: int | str | bool | None = None

    message: str

    block_ids: list[str] = Field(
        default_factory=list
    )

    source_url: str | None = None
    
class ManuscriptParsedData(BaseModel):
    title: str
    title_word_count: int

    abstract: str
    abstract_word_count: int

    keywords: list[str]

    full_document_word_count: int
    main_text_word_count: int

    reference_count: int
    references: list[str]

    table_count: int
    figure_count: int

    sections: list[SectionInfo]

    blocks: list[Block] = Field(default_factory=list)

    full_text: str