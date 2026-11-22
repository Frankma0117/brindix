package com.brindix.videos.studio;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface VideoSpecRepository extends JpaRepository<VideoSpecRow, Long> {

    List<VideoSpecRow> findAllByOrderByIdDesc();
}
